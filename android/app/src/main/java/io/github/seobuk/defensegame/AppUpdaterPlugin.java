package io.github.seobuk.defensegame;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

// APK 자가 업데이트: 앱 전용 폴더(files/updates)에 받고 시스템 설치 화면 호출
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);

    private File dir() { return new File(getContext().getFilesDir(), "updates"); }
    private File apk() { return new File(dir(), "update.apk"); }

    @Override
    public void load() {
        // 이미 설치된 버전 이하인 남은 APK 정리
        io.execute(() -> {
            try {
                PackageInfo d = archive(apk());
                if (apk().exists() && (d == null || code(d) <= code(self()))) apk().delete();
            } catch (Exception ignored) {}
        });
    }

    private PackageInfo self() throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
    }

    private static long code(PackageInfo p) { return PackageInfoCompat.getLongVersionCode(p); }

    // APK 파일이 우리 앱 패키지인지 확인 (깨졌거나 다른 앱이면 null)
    private PackageInfo archive(File f) {
        if (!f.isFile()) return null;
        PackageInfo p = getContext().getPackageManager().getPackageArchiveInfo(f.getPath(), 0);
        return p != null && getContext().getPackageName().equals(p.packageName) ? p : null;
    }

    private static boolean allowedUrl(String s) {
        try {
            URL u = new URL(s);
            if ("https".equals(u.getProtocol())) return true;
            // 디버그 빌드 전용: 에뮬레이터에서 PC 로컬 목 서버(10.0.2.2) 테스트
            return BuildConfig.DEBUG && "http".equals(u.getProtocol()) && "10.0.2.2".equals(u.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo me = self();
            JSObject r = new JSObject();
            r.put("versionName", me.versionName);
            r.put("versionCode", code(me));
            // 이전에 받아 둔 더 높은 버전 APK가 있으면 알려줌 (재다운로드 생략용)
            PackageInfo d = archive(apk());
            if (d != null && code(d) > code(me)) {
                JSObject o = new JSObject();
                o.put("path", apk().getAbsolutePath());
                o.put("versionName", d.versionName);
                o.put("versionCode", code(d));
                r.put("downloaded", o);
            }
            call.resolve(r);
        } catch (Exception e) {
            call.reject("버전 정보를 읽지 못했어요", "INFO_FAILED", e);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        if (!allowedUrl(url)) {
            call.reject("업데이트 주소가 올바르지 않아요", "BAD_URL");
            return;
        }
        if (!busy.compareAndSet(false, true)) {
            call.reject("이미 다운로드 중이에요", "BUSY");
            return;
        }
        io.execute(() -> {
            try {
                fetch(url, call);
            } finally {
                busy.set(false);
            }
        });
    }

    private void fetch(String url, PluginCall call) {
        File dir = dir(), part = new File(dir, "update.apk.part"), out = apk();
        HttpURLConnection c = null;
        try {
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("mkdir");
            // 리다이렉트는 직접 따라감 (github.com -> objects.githubusercontent.com), 단계마다 주소 검사
            for (int hop = 0; ; hop++) {
                if (hop > 5) {
                    call.reject("다운로드 주소가 너무 많이 바뀌었어요", "HTTP_ERROR");
                    return;
                }
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("Accept", "application/octet-stream");
                int st = c.getResponseCode();
                if (st >= 300 && st < 400) {
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    c = null;
                    url = loc == null ? "" : new URL(new URL(url), loc).toString();
                    if (!allowedUrl(url)) {
                        call.reject("업데이트 주소가 올바르지 않아요", "BAD_URL");
                        return;
                    }
                    continue;
                }
                if (st != 200) {
                    call.reject("다운로드 서버 오류 (" + st + ")", "HTTP_ERROR");
                    return;
                }
                break;
            }
            long total = c.getContentLengthLong(), got = 0;
            int last = -2;
            try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(part)) {
                byte[] buf = new byte[64 * 1024];
                for (int n; (n = in.read(buf)) != -1; ) {
                    os.write(buf, 0, n);
                    got += n;
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    if (pct != last) {
                        last = pct;
                        JSObject p = new JSObject();
                        p.put("pct", pct);
                        p.put("bytes", got);
                        p.put("total", total);
                        notifyListeners("progress", p);
                    }
                }
            }
            if (total > 0 && got != total) throw new IOException("incomplete");
            if (out.exists() && !out.delete()) throw new IOException("delete");
            if (!part.renameTo(out)) throw new IOException("rename");
            PackageInfo pi = archive(out);
            if (pi == null) {
                out.delete();
                call.reject("받은 파일이 올바른 설치 파일이 아니에요", "BAD_APK");
                return;
            }
            JSObject r = new JSObject();
            r.put("path", out.getAbsolutePath());
            r.put("versionName", pi.versionName);
            r.put("versionCode", code(pi));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("다운로드에 실패했어요. 네트워크를 확인해 주세요", "DOWNLOAD_FAILED", e);
        } finally {
            part.delete();
            if (c != null) c.disconnect();
        }
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    // '출처를 알 수 없는 앱 설치' 허용 화면 (이 앱 전용)
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent i = Build.VERSION.SDK_INT >= 26
            ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))
            : new Intent(Settings.ACTION_SECURITY_SETTINGS);
        try {
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("설정 화면을 열 수 없어요", "SETTINGS_FAILED", e);
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        File f;
        try {
            f = new File(call.getString("path", "")).getCanonicalFile();
            // 우리 업데이트 폴더 안의 .apk만 허용
            if (!dir().getCanonicalFile().equals(f.getParentFile()) || !f.getName().endsWith(".apk")) {
                call.reject("설치 파일 경로가 올바르지 않아요", "BAD_PATH");
                return;
            }
        } catch (IOException e) {
            call.reject("설치 파일 경로가 올바르지 않아요", "BAD_PATH", e);
            return;
        }
        if (!f.isFile()) {
            call.reject("설치 파일이 없어요. 다시 받아 주세요", "FILE_MISSING");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("설치 화면을 열 수 없어요", "INSTALL_FAILED", e);
        }
    }
}
