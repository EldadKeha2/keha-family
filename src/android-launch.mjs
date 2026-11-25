export const ANDROID_LAUNCH_HOME='/assets/app-icons/android-launch-v1/';

// Android's launcher foreground occupies 66 of its 108 icon units. Chrome's
// recreated Android 12+ splash displays the complete foreground bitmap.
// The recordings measured 174px followed by 286px (approximately 66/108).
export const ANDROID_SPLASH_ARTWORK_SCALE=66/108;

export function androidLaunchProfile(deviceScale=1){
  const quarter=Math.ceil(Math.max(1,Math.min(6,Number(deviceScale)||1))*4);
  const density=quarter/4;
  // Chromium uses Android density for its 83dp/128dp requests, whereas the
  // page's devicePixelRatio can also include browser zoom. Putting the primary
  // bitmap directly at 83dp lets both requests select the splash when the
  // Android density is higher. Place it between the two ideals instead.
  const primaryTarget=Math.sqrt(83*128)*density;
  const lowestPageDensity=quarter===4?1:(quarter-1)/4;
  // Keep the primary below the splash request at the bottom of every bucket,
  // including the first 1.0–1.25 density interval.
  const primaryLimit=Math.floor(128*lowestPageDensity)-1;
  return {quarter,density,primarySize:Math.min(Math.ceil(primaryTarget),primaryLimit),splashSize:Math.ceil(128*density)};
}
