// 로컬 릴리스: 서명된 APK 빌드 → dist/defense-game.apk → 태그 → GitHub Release 첨부
// 사용: npm run release            (실제 배포)
//       npm run release -- --dry-run (빌드·검증만, 태그/푸시/릴리스 없음)
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const WIN = process.platform === 'win32';
const APK_OUT = join(ROOT, 'dist', 'defense-game.apk');

const die = (msg) => {
  console.error(`\n[release] 중단: ${msg}`);
  process.exit(1);
};
// dry-run 에서는 배포 전제 조건 위반을 경고로만 처리 (빌드 검증은 계속)
const need = (ok, msg) => {
  if (ok) return;
  if (DRY) console.warn(`[release] 경고(dry-run): ${msg}`);
  else die(msg);
};
const out = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();
const q = (a) => (/[\s"]/.test(a) ? `"${a}"` : a);
const run = (cmd, args, opts = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  // Windows 의 .bat/.cmd(npx, gradlew, apksigner)는 셸로 실행 (인자는 전부 이 스크립트가 만든 값)
  const shell = WIN && /(\.bat|\.cmd|^npx)$/i.test(cmd);
  const r = shell
    ? spawnSync([cmd, ...args].map(q).join(' '), { cwd: ROOT, stdio: 'inherit', shell: true, ...opts })
    : spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) die(`${cmd} 실패 (exit ${r.status})`);
};

// 1) 버전
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d{1,2}\.\d{1,2}$/.test(version)) die(`package.json version 형식 오류: ${version} (X.Y.Z, Y·Z < 100)`);
const tag = `v${version}`;
console.log(`[release] ${tag}${DRY ? ' (dry-run)' : ''}`);

// 2) git 상태
need(out('git', ['status', '--porcelain']) === '', '커밋 안 된 변경이 있습니다 (git status 확인)');
need(out('git', ['rev-parse', '--abbrev-ref', 'HEAD']) === 'main', 'main 브랜치가 아닙니다');
const localTag = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT }).status === 0;
need(!localTag, `태그 ${tag} 가 이미 로컬에 있습니다 — package.json 버전을 올리세요`);
let remoteTag = '';
try {
  remoteTag = out('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
} catch {
  need(false, 'origin 태그 확인 실패 (네트워크?)');
}
need(!remoteTag, `태그 ${tag} 가 이미 origin 에 있습니다 — package.json 버전을 올리세요`);
if (!DRY) {
  const ahead = out('git', ['rev-list', '--count', 'origin/main..HEAD']);
  need(ahead === '0', 'origin/main 에 푸시 안 된 커밋이 있습니다 (git push 먼저)');
  need(spawnSync('gh', ['auth', 'status'], { cwd: ROOT, stdio: 'ignore' }).status === 0, 'gh 로그인이 필요합니다 (gh auth login)');
}

// 3) 서명 키 (gradle 과 같은 규칙)
const ksProps = process.env.DEFENSE_KEYSTORE_PROPERTIES || join(homedir(), '.defense-game', 'keystore.properties');
if (!existsSync(ksProps) && !process.env.DEFENSE_STORE_FILE) die(`서명 키 설정이 없습니다: ${ksProps}`);

// 4) 빌드
run('npx', ['cap', 'sync', 'android']);
run(join(ROOT, 'android', WIN ? 'gradlew.bat' : 'gradlew'),['assembleRelease', '--console=plain'], { cwd: join(ROOT, 'android') });
const built = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(built)) die('서명된 app-release.apk 가 없습니다 (서명 설정 확인)');
mkdirSync(dirname(APK_OUT), { recursive: true });
copyFileSync(built, APK_OUT);

// 5) 서명 검증
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || join(homedir(), 'Library'), 'Android', 'Sdk');
const btDir = join(sdk, 'build-tools');
const bt = existsSync(btDir)
  ? readdirSync(btDir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()
  : null;
if (!bt) die(`build-tools 를 찾을 수 없습니다: ${btDir}`);
run(join(btDir, bt, WIN ? 'apksigner.bat' : 'apksigner'), ['verify', '--print-certs', APK_OUT]);
console.log(`\n[release] 빌드 완료: ${APK_OUT}`);

if (DRY) {
  console.log('[release] dry-run: 태그/푸시/GitHub Release 생략');
  process.exit(0);
}

// 6) 태그 → 푸시 → GitHub Release
run('git', ['tag', '-a', tag, '-m', tag]);
run('git', ['push', 'origin', tag]);
const notesArgs = ['--generate-notes'];
const notesFile = join(ROOT, 'RELEASE_NOTES.md');
if (existsSync(notesFile)) {
  // "## v1.2.3" 또는 "## 1.2.3" 섹션 본문
  const md = readFileSync(notesFile, 'utf8');
  const esc = version.replace(/\./g, '\\.');
  const m = new RegExp(`^##\\s+v?${esc}\\b[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm').exec(md);
  if (m && m[1].trim()) {
    const f = join(mkdtempSync(join(tmpdir(), 'relnotes-')), 'notes.md');
    writeFileSync(f, m[1].trim() + '\n');
    notesArgs.splice(0, 1, '--notes-file', f);
  }
}
const gh = spawnSync('gh', ['release', 'create', tag, APK_OUT, '--title', tag, ...notesArgs], { cwd: ROOT, stdio: 'inherit' });
if (gh.status !== 0) {
  die(`gh release 실패. 태그 ${tag} 는 이미 푸시됨 → 다시 시도: gh release create ${tag} dist/defense-game.apk --title ${tag} --generate-notes`);
}
console.log(`\n[release] 완료: https://github.com/Seobuk/defense-game/releases/tag/${tag}`);
