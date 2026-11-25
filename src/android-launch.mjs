export const ANDROID_LAUNCH_HOME='/assets/app-icons/android-launch-v1/';

// Retain the manifest addresses already recorded in installed WebAPKs. The
// manifests now use ordinary PNG icons; DPR no longer controls icon artwork.
export function androidLaunchProfile(deviceScale=1){
  const quarter=Math.ceil(Math.max(1,Math.min(6,Number(deviceScale)||1))*4);
  return {quarter,density:quarter/4};
}
