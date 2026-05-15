import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

export const textureUrls: Record<string, string> = {};

// Create a simple procedural texture with pixel art style
export function createTexture(name: string, layers: ((ctx: CanvasRenderingContext2D) => void)[]): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  
  // Fill base color
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 16);
  
  layers.forEach(layer => layer(ctx));
  
  textureUrls[name] = canvas.toDataURL();
  
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter; // Pixelated Look
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function noise(ctx: CanvasRenderingContext2D, colors: string[]) {
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

export const textures = {
  grass_top: createTexture('grass_top', [
    (ctx) => noise(ctx, ['#67A246', '#5D983C', '#6CB14A', '#518534', '#609B3E'])
  ]),
  dirt: createTexture('dirt', [
    (ctx) => noise(ctx, ['#866043', '#755137', '#976E4D', '#66432B'])
  ]),
  grass_side: createTexture('grass_side', [
    (ctx) => noise(ctx, ['#866043', '#755137', '#976E4D', '#66432B']), // Dirt base
    (ctx) => {
      // Grass overlapping the top
      for (let x = 0; x < 16; x++) {
          const depth = 4 + Math.floor(Math.random() * 3); // Random grass drip length
          for (let y = 0; y < depth; y++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#67A246' : '#5D983C';
            ctx.fillRect(x, y, 1, 1);
          }
      }
    }
  ]),
  stone: createTexture('stone', [
    (ctx) => {
        const colors = ['#7D7D7D', '#717171', '#848484', '#666666', '#8C8C8C'];
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                // Diagonally sloped noise for typical stone look
                const val = (Math.sin(x*1.5 + y) + Math.cos(x - y*1.5)) * 0.5 + Math.random();
                let color;
                if (val > 1.2) color = colors[2];
                else if (val > 0.6) color = colors[0];
                else if (val > -0.2) color = colors[1];
                else color = colors[3];
                
                // Random variation
                if (Math.random() > 0.8) color = colors[4];

                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
  ]),
  wood_side: createTexture('wood_side', [
    (ctx) => {
        ctx.fillStyle = '#725b44';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#5c4731';
        for (let x=0; x<16; x++) {
            if (x%2===0 || Math.random()>0.7) ctx.fillRect(x, 0, 1, 16);
        }
        ctx.fillStyle = '#3d2d1e';
        for (let i=0; i<15; i++) {
            const x = Math.random()*16|0;
            const y = Math.random()*16|0;
            ctx.fillRect(x, y, 1, 2 + (Math.random()*4|0));
        }
    }
  ]),
  wood_top: createTexture('wood_top', [
    (ctx) => {
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#c49d68';
        ctx.fillRect(1,1,14,14);
        ctx.fillStyle = '#ad844c';
        ctx.fillRect(2,2,12,12);
        ctx.fillStyle = '#c49d68';
        ctx.fillRect(4,4,8,8);
        ctx.fillStyle = '#ad844c';
        ctx.fillRect(5,5,6,6);
        ctx.fillStyle = '#c49d68';
        ctx.fillRect(6,6,4,4);
    }
  ]),
  sand: createTexture('sand', [
    (ctx) => noise(ctx, ['#e3d4ae', '#dbc9a0', '#ecdca8', '#cfbc91', '#d4c59a'])
  ]),
  leaves: createTexture('leaves', [
    (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        const colors = ['#3D8225', '#4B9C30', '#2E6619', '#57B539'];
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                if (Math.random() > 0.15) { // 15% holes
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
  ]),
  snow: createTexture('snow', [
    (ctx) => noise(ctx, ['#ffffff', '#f2f2f2', '#ebebeb', '#e0e0e0'])
  ]),
  tall_grass_1: createTexture('tall_grass_1', [
    (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#4c8735';
        for (let i = 0; i < 4; i++) {
            let x = 6 + Math.random() * 4 | 0;
            let y = 15;
            while(y > 2 + Math.random() * 6) {
                ctx.fillRect(x, y, 1, 1);
                x += (Math.random() * 3 | 0) - 1;
                y--;
            }
        }
    }
  ]),
  tall_grass_2: createTexture('tall_grass_2', [
    (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#4c8735';
        for (let i = 0; i < 5; i++) {
            let x = 4 + Math.random() * 8 | 0;
            let y = 15;
            while(y > 1 + Math.random() * 5) {
                ctx.fillRect(x, y, 1, 1);
                x += (Math.random() * 3 | 0) - 1;
                y--;
            }
        }
    }
  ]),
  tall_grass_3: createTexture('tall_grass_3', [
    (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#4c8735';
        for (let i = 0; i < 6; i++) {
            let x = 2 + Math.random() * 12 | 0;
            let y = 15;
            while(y > 3 + Math.random() * 5) {
                ctx.fillRect(x, y, 1, 1);
                x += (Math.random() * 3 | 0) - 1;
                y--;
            }
        }
    }
  ]),
  water: createTexture('water', [
    (ctx) => {
      ctx.fillStyle = '#2B5EB5'; // Deeper, more saturated blue matching the image
      ctx.fillRect(0,0,16,16);
      ctx.fillStyle = '#3169C5';
      for(let i=0; i<30; i++) ctx.fillRect(Math.random()*16|0, Math.random()*16|0, 1, 1);
      ctx.fillStyle = '#24509B';
      for(let i=0; i<20; i++) ctx.fillRect(Math.random()*16|0, Math.random()*16|0, 1, 1);
    }
  ]),
  dandelion: createTexture('dandelion', [
      (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0,0,16,16);
        // Stems
        ctx.fillStyle = '#4b8235';
        ctx.fillRect(7, 8, 2, 8);
        ctx.fillRect(8, 6, 1, 3);
        // Yellow flower
        ctx.fillStyle = '#e8db27';
        ctx.fillRect(5, 3, 5, 5);
        ctx.fillStyle = '#fceb20';
        ctx.fillRect(6, 4, 3, 3);
      }
  ]),
  rose: createTexture('rose', [
    (ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0,0,16,16);
        // Stems
        ctx.fillStyle = '#3c7030';
        ctx.fillRect(7, 8, 2, 8);
        ctx.fillRect(6, 7, 1, 3);
        // Leaves
        ctx.fillRect(5, 12, 5, 2);
        // Red flower
        ctx.fillStyle = '#d11515';
        ctx.fillRect(5, 3, 6, 6);
        ctx.fillStyle = '#ff2b2b';
        ctx.fillRect(6, 4, 4, 4);
      }
  ]),
  bedrock: createTexture('bedrock', [
    (ctx) => {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 60; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#1a1a1a' : '#333333';
          ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
      }
    }
  ])
};
