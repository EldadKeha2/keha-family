export const ANDROID_LAUNCH_HOME='/assets/app-icons/android-launch-v1/';

// Android's launcher foreground occupies 66 of its 108 icon units. Chrome's
// recreated Android 12+ splash displays the complete foreground bitmap.
// The recordings measured 174px followed by 286px (approximately 66/108).
export const ANDROID_SPLASH_ARTWORK_SCALE=66/108;

export function androidLaunchProfile(deviceScale=1){
  const quarter=Math.ceil(Math.max(1,Math.min(6,Number(deviceScale)||1))*4);
  const density=quarter/4;
  // Chromium selects a maskable primary icon at 83dp, and a splash at 128dp.
  // Rounding density upwards keeps the first bitmap above the primary ideal
  // and below the splash ideal throughout each quarter-density interval.
  return {quarter,density,primarySize:Math.ceil(83*density),splashSize:Math.ceil(128*density)};
}
