package io.github.seobuk.defensegame;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        applyOrientationLock();
    }

    // 폰: 세로 고정 / 큰 화면(폴더블 안쪽 화면 펼침 등, res/values-sw600dp): 자유 회전.
    // configChanges에 orientation|screenSize|smallestScreenSize|screenLayout이 선언돼 있어
    // 접기·펼치기 때 액티비티가 재생성되지 않고 이 콜백만 다시 불린다.
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyOrientationLock();
    }

    private void applyOrientationLock() {
        boolean lockPortrait = getResources().getBoolean(R.bool.lock_portrait);
        setRequestedOrientation(lockPortrait
            ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }

    // 몰입 모드: 상태바/내비게이션바 숨김 (스와이프하면 잠깐 보임)
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) return;
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
