import { createNoise2D } from 'simplex-noise';

export const baseNoise2D = createNoise2D(); 
export const mountainNoise2D = createNoise2D(); 
export const biomeNoise2D = createNoise2D(); 
export const riverNoise2D = createNoise2D(); 

export const WATER_LEVEL = 2;

export function getElevation(x: number, z: number) {
  return getBiomeInfo(x, z).elevation;
}

export function getBiomeInfo(x: number, z: number) {
  let scale = 0.003;
  
  // Continentalness: main landmass shapes. Shift baseline up to have more land, less ocean
  let c = baseNoise2D(x * scale, z * scale) + 0.2; 
  
  // Biome: Forest? (Makes trees appear in chunks)
  let b = biomeNoise2D(x * scale * 2.0, z * scale * 2.0);
  let isForest = b > -0.3; 
  
  // Mountains (Mountain ranges) - wider and higher
  let mountainRegion = mountainNoise2D(x * scale * 0.4, z * scale * 0.4);
  let mFactor = Math.max(0, mountainRegion + 0.3) / 1.3; 
  let isMountain = mFactor > 0.01;
  
  let elevation = 0;

  // Ocean shifted lower
  if (c < -0.2) {
      // Ocean (Deep water)
      elevation = 1 + (c + 0.2) * 30; // goes deeper into ocean floor
  } else if (c < -0.1) {
      // Beach / transitions (very small beach)
      // at -0.2 = elevation 1
      // at -0.1 = elevation 3
      elevation = 1 + ((c + 0.2) / 0.1) * 2;
  } else {
      // Land
      // at c = -0.1 -> elevation 3
      elevation = 3 + ((c + 0.1) / 1.1) * 15;
      
      // Plains rolling hills (much softer)
      elevation += Math.pow(Math.abs(baseNoise2D(x * scale * 6, z * scale * 6)), 2) * 3;

      // Add mountain ranges
      if (mFactor > 0) {
          // Use ridge noise to create mountain peaks - lower frequency for thicker mountains
          let ridgeNoise = mountainNoise2D(x * scale * 1.2, z * scale * 1.2);
          let ridge = 1 - Math.abs(ridgeNoise); 
          
          let mountainHeight = Math.pow(mFactor, 1.1) * 140; // Much higher mountains (up to ~140 blocks high)
          let mountainStr = mountainHeight * Math.pow(ridge, 1.2); // Thicker shape (less sharp exponent)
          
          // Details
          let detail = mountainNoise2D(x * scale * 12, z * scale * 12) * 8 * mFactor; 
          
          elevation += mountainStr + detail;
      }
  }

  // Smooth out bottoms to prevent weird single block deep pools
  elevation = Math.max(-10, elevation); 
  
  return { 
      elevation, 
      isForest: isForest && !isMountain && elevation >= 2 && elevation < 30,
      isMountain,
  };
}

export function checkIsTree(x: number, z: number): boolean {
  const { elevation, isForest, isMountain } = getBiomeInfo(x, z);
  const currentH = Math.floor(elevation);
  const chunkX = Math.floor(x / 16);
  const chunkZ = Math.floor(z / 16);
  const lx = x - chunkX * 16;
  const lz = z - chunkZ * 16;
  
  if (currentH <= 2 || currentH >= 35) return false;
  if (lx <= 2 || lx >= 13 || lz <= 2 || lz >= 13) return false;
  
  const treeNoise = Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1);
  const treeThreshold = isForest ? 0.90 : 0.995; // More trees in forest
  
  if (treeNoise > treeThreshold) {
      // Crude local maxima check
      const n1 = Math.abs((Math.sin((x+1) * 12.9898 + z * 78.233) * 43758.5453) % 1);
      const n2 = Math.abs((Math.sin((x-1) * 12.9898 + z * 78.233) * 43758.5453) % 1);
      const n3 = Math.abs((Math.sin(x * 12.9898 + (z+1) * 78.233) * 43758.5453) % 1);
      const n4 = Math.abs((Math.sin(x * 12.9898 + (z-1) * 78.233) * 43758.5453) % 1);
      if (treeNoise > n1 && treeNoise > n2 && treeNoise > n3 && treeNoise > n4) {
          return true;
      }
  }
  return false;
}
