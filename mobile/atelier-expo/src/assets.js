import { SERVER_BASE_URL } from './api';

const drawableImages = {
  lot_birkin_himalaya: require('../assets/lots/lot_birkin_himalaya.png'),
  lot_bronce_vertical: require('../assets/lots/lot_bronce_vertical.png'),
  lot_cartier_tank: require('../assets/lots/lot_cartier_tank.png'),
  lot_chesterfield: require('../assets/lots/lot_chesterfield.png'),
  lot_ferrari_275: require('../assets/lots/lot_ferrari_275.png'),
  lot_leica_m6: require('../assets/lots/lot_leica_m6.png'),
  lot_litografia: require('../assets/lots/lot_litografia.png'),
  lot_montblanc: require('../assets/lots/lot_montblanc.png'),
  lot_omega_seamaster: require('../assets/lots/lot_omega_seamaster.png'),
  lot_patek_3940: require('../assets/lots/lot_patek_3940.png'),
  lot_perriand_table: require('../assets/lots/lot_perriand_table.png'),
  lot_riviera_diamonds: require('../assets/lots/lot_riviera_diamonds.png'),
  lot_rolex_daydate: require('../assets/lots/lot_rolex_daydate.png'),
  lot_royal_oak: require('../assets/lots/lot_royal_oak.png'),
  lot_thorens_td160: require('../assets/lots/lot_thorens_td160.png'),
};

export const appAssets = {
  bell: require('../assets/bell.png'),
  camera: require('../assets/camera.png'),
  hammer: require('../assets/hammer.png'),
  splash: require('../assets/splash_reference.png'),
};

export function imageSource(value) {
  if (!value) {
    return null;
  }

  if (value.startsWith('drawable://')) {
    const key = value.replace('drawable://', '');
    return drawableImages[key] || null;
  }

  if (value.startsWith('/')) {
    return { uri: `${SERVER_BASE_URL}${value}` };
  }

  return { uri: value };
}
