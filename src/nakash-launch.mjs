export const themedFamilies = new Set(['yehuda', 'haim', 'medina']);
export const launchAssets = family => '/assets/nakash-launch-v1/' + family;

// Safari selects the launch PNG by the screen's dimensions in points, scale and orientation.
// Several iPhone and iPad models share each specification.
export const appleScreens = [
  [320, 568, 2], [375, 667, 2], [375, 667, 3], [414, 736, 3],
  [360, 780, 3], [375, 812, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [414, 896, 2], [414, 896, 3], [420, 912, 3],
  [428, 926, 3], [430, 932, 3], [440, 956, 3],
  [744, 1133, 2], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2],
  [834, 1112, 2], [834, 1194, 2], [834, 1210, 2], [1024, 1366, 2], [1032, 1376, 2],
];

export function appleLaunchImages(family) {
  return appleScreens.flatMap(([width, height, scale]) => {
    const device = `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale})`;
    return ['portrait', 'landscape'].map(orientation => {
      const w = (orientation === 'portrait' ? width : height) * scale;
      const h = (orientation === 'portrait' ? height : width) * scale;
      return {width:w, height:h, scale, href:`${launchAssets(family)}/${w}x${h}.png`, media:`${device} and (orientation: ${orientation})`};
    });
  });
}
