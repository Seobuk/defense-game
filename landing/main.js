document.addEventListener('DOMContentLoaded', () => {
  const releaseInfoEl = document.getElementById('release-info');
  
  async function fetchLatestRelease() {
    try {
      const response = await fetch('https://api.github.com/repos/Seobuk/defense-game/releases/latest');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      const version = data.tag_name || data.name || '최신 버전';
      
      let dateText = '';
      if (data.published_at) {
        const date = new Date(data.published_at);
        dateText = ` (${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')})`;
      }

      let sizeText = '';
      if (data.assets && data.assets.length > 0) {
        const apkAsset = data.assets.find(a => a.name.endsWith('.apk'));
        if (apkAsset && apkAsset.size) {
          const mb = (apkAsset.size / (1024 * 1024)).toFixed(1);
          sizeText = ` / ${mb}MB`;
        }
      }

      releaseInfoEl.textContent = `${version}${dateText}${sizeText}`;
    } catch (error) {
      console.warn('Failed to fetch latest release:', error);
      releaseInfoEl.textContent = '최신 버전';
    }
  }

  fetchLatestRelease();
});
