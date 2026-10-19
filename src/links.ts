// Links within the game, under the sub-path of furedea.com it is served at.

export const BASE_PATH = "/effort-or-luck/";

export const LINKS = {
  game: BASE_PATH,
  sources: `${BASE_PATH}sources/`,
  share: `${BASE_PATH}share/`,
  favicon: `${BASE_PATH}favicon.svg`,
  faviconPng: `${BASE_PATH}favicon.png`,
  appleTouchIcon: `${BASE_PATH}apple_touch_icon.png`,
  ogImage: `${BASE_PATH}og_image.png`,
} as const;
