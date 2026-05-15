import { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { getElevation, getBiomeInfo, checkIsTree } from '../lib/noise';
import { textures } from '../lib/textures';
import { isBlockBroken, placedBlocks, brokenBlocks } from '../lib/store';

export const CHUNK_SIZE = 16;

type BlockType = 'grass' | 'dirt' | 'stone' | 'sand' | 'wood' | 'leaves' | 'snow' | 'water' | 'bedrock';

export function Chunk({ chunkX, chunkZ }: { chunkX: number, chunkZ: number }) {
  // Force update when block is broken
  const [updateTick, setUpdateTick] = useState(0);
  const groupRef = useRef<any>(null);

  useFrame((_, delta) => {
    // Drop animation removed
  });

  useEffect(() => {
    const handleBlockBroken = (e: any) => {
      const { x, y, z } = e.detail;
      // We trigger update if it's within chunk OR adjacent (for neighbor exposure)
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      
      if (cx === chunkX && cz === chunkZ) {
          setUpdateTick(u => u + 1);
      } else {
          // Mod in JS can be negative, so we use ((a % n) + n) % n
          const modX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const modZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          if (
              (cx === chunkX - 1 && modX === CHUNK_SIZE - 1) ||
              (cx === chunkX + 1 && modX === 0) ||
              (cz === chunkZ - 1 && modZ === CHUNK_SIZE - 1) ||
              (cz === chunkZ + 1 && modZ === 0)
          ) {
              setUpdateTick(u => u + 1);
          }
      }
    };
    window.addEventListener('block_broken', handleBlockBroken);
    return () => window.removeEventListener('block_broken', handleBlockBroken);
  }, [chunkX, chunkZ]);

  const { blocks, flora, liquids } = useMemo(() => {
    const list: Record<BlockType, {x: number, y: number, z: number}[]> = {
        grass: [], dirt: [], stone: [], sand: [], wood: [], leaves: [], snow: [], water: [], bedrock: []
    };
    const floraPositions: {x: number, y: number, z: number, type: string}[] = [];
    const liquidPositions: {x: number, y: number, z: number, sy?: number}[] = [];
    
    const actualHeights = new Int16Array(18 * 18);
    for (let lx = -1; lx <= 16; lx++) {
        for (let lz = -1; lz <= 16; lz++) {
            const ax = chunkX * CHUNK_SIZE + lx;
            const az = chunkZ * CHUNK_SIZE + lz;
            actualHeights[(lx + 1) * 18 + (lz + 1)] = Math.floor(getBiomeInfo(ax, az).elevation);
        }
    }
    
    let hasLocalMods = false;
    const localBroken = new Set<string>();
    const localPlaced = new Map<string, string>();
    
    const minX = chunkX * CHUNK_SIZE - 2;
    const maxX = chunkX * CHUNK_SIZE + CHUNK_SIZE + 2;
    const minZ = chunkZ * CHUNK_SIZE - 2;
    const maxZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE + 2;

    brokenBlocks.forEach(key => {
        const [xs, ys, zs] = key.split('_');
        const x = parseInt(xs, 10);
        const z = parseInt(zs, 10);
        if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
            hasLocalMods = true;
            localBroken.add(key);
        }
    });
    
    placedBlocks.forEach((val, key) => {
        const [xs, ys, zs] = key.split('_');
        const x = parseInt(xs, 10);
        const z = parseInt(zs, 10);
        if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
            hasLocalMods = true;
            localPlaced.set(key, val);
        }
    });

    // Helper to check if a block is solid
    const checkIsSolid = (bx: number, by: number, bz: number) => {
        if (hasLocalMods) {
            const key = `${bx}_${by}_${bz}`;
            const placed = localPlaced.get(key);
            if (placed) {
                if (placed === 'dandelion' || placed === 'rose' || placed.startsWith('tall_grass')) return false;
                if (placed === 'water') return false;
                return true;
            }
            if (localBroken.has(key)) return false;
        }
        
        const lx = bx - chunkX * CHUNK_SIZE;
        const lz = bz - chunkZ * CHUNK_SIZE;
        return by <= actualHeights[(lx + 1) * 18 + (lz + 1)];
    };
    
    const isBlockBrokenLocal = (bx: number, by: number, bz: number) => {
        if (!hasLocalMods) return false;
        return localBroken.has(`${bx}_${by}_${bz}`);
    };
    
    // Check if block has any non-solid neighbor
    const isExposed = (bx: number, by: number, bz: number) => {
        if (!checkIsSolid(bx + 1, by, bz)) return true;
        if (!checkIsSolid(bx - 1, by, bz)) return true;
        if (!checkIsSolid(bx, by + 1, bz)) return true;
        if (!checkIsSolid(bx, by - 1, bz)) return true;
        if (!checkIsSolid(bx, by, bz + 1)) return true;
        if (!checkIsSolid(bx, by, bz - 1)) return true;
        return false;
    };
    
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = chunkX * CHUNK_SIZE + lx;
        const z = chunkZ * CHUNK_SIZE + lz;
        const { elevation, isForest, isMountain } = getBiomeInfo(x, z);
        const h = Math.floor(elevation);
        
        // Water Generation (ocean level is 2)
        const waterLevel = 2;
        if (h < waterLevel) {
            for (let y = h + 1; y <= waterLevel; y++) {
                if (!isBlockBrokenLocal(x, y, z)) {
                    // Quick check if surrounded by water and seabed, so we can cull internal water
                    const isInternal = (y < waterLevel) && (checkIsSolid(x+1, y, z) || (getBiomeInfo(x+1,z).elevation < y)) && 
                                       (checkIsSolid(x-1, y, z) || (getBiomeInfo(x-1,z).elevation < y)) && 
                                       (checkIsSolid(x, y, z+1) || (getBiomeInfo(x,z+1).elevation < y)) && 
                                       (checkIsSolid(x, y, z-1) || (getBiomeInfo(x,z-1).elevation < y));
                    if (!isInternal) {
                        liquidPositions.push({x, y, z});
                    }
                }
            }
        }
        
        const treeNoise = Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1);
        const localNoise = treeNoise * 5; // pseudo-random noise for threshold variance 0 to 5
        const isTree = checkIsTree(x, z);
        
        const hasTallGrass = !isTree && treeNoise > 0.93 && treeNoise <= 0.96 && h > waterLevel + 1 && h < 40;
        const grassVariant = Math.floor(treeNoise * 100) % 3 + 1; // 1, 2, or 3
        const dandelionThreshold = isForest ? 0.96 : 0.97;
        const roseThreshold = isForest ? 0.98 : 0.985;
        const hasDandelion = !isTree && !hasTallGrass && treeNoise > dandelionThreshold && treeNoise <= roseThreshold && h > waterLevel + 1 && h < 40;
        const hasRose = !isTree && !hasTallGrass && !hasDandelion && treeNoise > roseThreshold && treeNoise <= roseThreshold + 0.005 && h > waterLevel + 1 && h < 40;

        let topBlockType = 'stone';

        // We only need to check down to a reasonable depth (-20) since we cull unexposed blocks
        for (let y = h; y >= -20; y--) {
            if (isBlockBrokenLocal(x, y, z)) continue;
            
            // Critical fix: Only render if exposed to air/water to heavily optimize instances
            if (!isExposed(x, y, z)) continue;
            
            let type: BlockType = 'stone';
            
            if (y <= -16) {
                type = 'bedrock';
            } else if (y < h - 4) {
                type = 'stone';
            } else {
                if (h <= waterLevel + 1) {
                    // Beach/Ocean
                    if (y >= waterLevel - 2) {
                        type = 'sand';
                    } else {
                        type = 'dirt';
                    }
                } else if (h > 55 + localNoise * 3) {
                    type = (y === h) ? 'snow' : 'stone';
                } else if (h > 35 + localNoise * 2) {
                    type = 'stone';
                } else {
                    if (y === h) {
                        type = 'grass';
                    } else {
                        type = 'dirt';
                    }
                }
            }
            
            if (y === h) topBlockType = type;
            if (!list[type]) list[type] = [];
            list[type].push({ x, y, z });
        }
        
        // Add Flora on top (only on grass)
        if (!isBlockBrokenLocal(x, h+1, z) && !isBlockBrokenLocal(x, h, z) && topBlockType === 'grass') {
            if (hasTallGrass) floraPositions.push({ x, y: h + 0.5, z, type: `tall_grass_${grassVariant}` });
            else if (hasDandelion) floraPositions.push({ x, y: h + 0.5, z, type: 'dandelion' });
            else if (hasRose) floraPositions.push({ x, y: h + 0.5, z, type: 'rose' });
        }

        // Create tree structure (only on grass)
        if (isTree && topBlockType === 'grass') {
           const trunkHeight = 4 + Math.floor((treeNoise * 10) % 3);
           for(let ty = 1; ty <= trunkHeight; ty++) {
               if (!isBlockBrokenLocal(x, h + ty, z)) list.wood.push({ x, y: h + ty, z });
           }
           for(let lly = trunkHeight - 1; lly <= trunkHeight + 1; lly++) {
               for(let llx = -2; llx <= 2; llx++) {
                   for(let llz = -2; llz <= 2; llz++) {
                       if (Math.abs(llx) === 2 && Math.abs(llz) === 2) continue;
                       if (lly === trunkHeight + 1 && (Math.abs(llx) > 1 || Math.abs(llz) > 1)) continue;
                       if (llx === 0 && llz === 0 && lly <= trunkHeight) continue;
                       if (!isBlockBrokenLocal(x + llx, h + lly, z + llz)) list.leaves.push({ x: x + llx, y: h + lly, z: z + llz });
                   }
               }
           }
        }
      }
    }
    
    // Add placed blocks
    for (let [key, bType] of Array.from(placedBlocks.entries())) {
        const [bxStr, byStr, bzStr] = key.split('_');
        const bx = parseInt(bxStr, 10);
        const by = parseInt(byStr, 10);
        const bz = parseInt(bzStr, 10);
        
        const bcx = Math.floor(bx / CHUNK_SIZE);
        const bcz = Math.floor(bz / CHUNK_SIZE);
        if (bcx === chunkX && bcz === chunkZ) {
            if (bType === 'dandelion' || bType === 'rose' || bType.startsWith('tall_grass')) {
                floraPositions.push({ x: bx, y: by - 0.5, z: bz, type: bType });
            } else if (bType === 'water') {
                liquidPositions.push({ x: bx, y: by, z: bz });
            } else {
                if (!list[bType as BlockType]) list[bType as BlockType] = [];
                list[bType as BlockType].push({ x: bx, y: by, z: bz });
            }
        }
    }

    return { blocks: list, flora: floraPositions, liquids: liquidPositions };
  }, [chunkX, chunkZ, updateTick]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
        {Object.entries(blocks).map(([type, positions]) => {
            if (!positions || positions.length === 0) return null;
            return <BlockMesh key={type} type={type as BlockType} positions={positions} />;
        })}
        {liquids.length > 0 && <BlockMesh key="water" type="water" positions={liquids} />}
        {flora.length > 0 && <FloraMesh positions={flora} />}
    </group>
  );
}

function BlockMesh({ type, positions }: { type: BlockType, positions: {x: number, y: number, z: number, sy?: number}[] }) {
    const meshRef = useRef<InstancedMesh>(null);
    const [maxLength, setMaxLength] = useState(() => Math.max(10, positions.length + 200));

    useEffect(() => {
        if (positions.length > maxLength) {
            setMaxLength(positions.length + 500);
        }
    }, [positions.length, maxLength]);

    useEffect(() => {
        if (!meshRef.current || !positions) return;
        meshRef.current.count = positions.length;
        const dummy = new Object3D();
        const isWater = type === 'water';

        positions.forEach((pos, i) => {
            dummy.position.set(pos.x, pos.y, pos.z);
            if (isWater) {
                // Water surface is just a plane laying flat
                dummy.rotation.set(-Math.PI / 2, 0, 0); 
                dummy.scale.set(1, 1, 1);
                dummy.position.set(pos.x, pos.y + 0.4, pos.z);
            } else {
                dummy.rotation.set(0, 0, 0); 
                if (pos.sy !== undefined) {
                    dummy.scale.set(1, pos.sy, 1);
                } else {
                    dummy.scale.set(1, 1, 1);
                }
            }
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.computeBoundingSphere) meshRef.current.computeBoundingSphere();
    }, [positions, type]);
    
    // Order of materials in BoxGeometry: +x, -x, +y, -y, +z, -z
    let materialContent;
    if (type === 'grass') {
        materialContent = (
            <>
                <meshStandardMaterial attach="material-0" map={textures.grass_side} roughness={1} />
                <meshStandardMaterial attach="material-1" map={textures.grass_side} roughness={1} />
                <meshStandardMaterial attach="material-2" map={textures.grass_top} roughness={1} />
                <meshStandardMaterial attach="material-3" map={textures.dirt} roughness={1} />
                <meshStandardMaterial attach="material-4" map={textures.grass_side} roughness={1} />
                <meshStandardMaterial attach="material-5" map={textures.grass_side} roughness={1} />
            </>
        );
    } else if (type === 'wood') {
        materialContent = (
            <>
                <meshStandardMaterial attach="material-0" map={textures.wood_side} roughness={1} />
                <meshStandardMaterial attach="material-1" map={textures.wood_side} roughness={1} />
                <meshStandardMaterial attach="material-2" map={textures.wood_top} roughness={1} />
                <meshStandardMaterial attach="material-3" map={textures.wood_top} roughness={1} />
                <meshStandardMaterial attach="material-4" map={textures.wood_side} roughness={1} />
                <meshStandardMaterial attach="material-5" map={textures.wood_side} roughness={1} />
            </>
        );
    } else if (type === 'water') {
        materialContent = <meshStandardMaterial attach="material" map={textures.water} transparent opacity={0.8} depthWrite={false} roughness={0.1} side={2} /> // side=2 is THREE.DoubleSide
    } else if (type === 'leaves') {
        materialContent = <meshStandardMaterial map={textures.leaves} roughness={0.8} transparent alphaTest={0.5} />
    } else if (type === 'bedrock') {
        materialContent = <meshStandardMaterial map={textures.bedrock} roughness={1} />;
    } else {
        const tex = textures[type as keyof typeof textures] as any;
        materialContent = <meshStandardMaterial map={tex} roughness={0.9} />;
    }

    return (
            <instancedMesh 
                ref={meshRef} 
                args={[undefined as any, undefined as any, maxLength]} 
                castShadow={type !== 'water'} 
                receiveShadow={type !== 'water'}
                frustumCulled={false}
                userData={{ type }}
            >
                {type === 'water' ? <planeGeometry args={[1, 1]} /> : <boxGeometry args={[1, 1, 1]} />}
                {materialContent}
            </instancedMesh>
    );
}

function FloraMesh({ positions }: { positions: {x: number, y: number, z: number, type: string}[] }) {
    const refs = {
        tall_grass_1: [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)],
        tall_grass_2: [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)],
        tall_grass_3: [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)],
        dandelion: [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)],
        rose: [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)],
    };
    
    useEffect(() => {
        if (!positions) return;
        const typeCounts: Record<string, number> = {
            tall_grass_1: 0, tall_grass_2: 0, tall_grass_3: 0, dandelion: 0, rose: 0
        };
        positions.forEach(p => {
            if (typeCounts[p.type] !== undefined) {
                typeCounts[p.type]++;
            }
        });
        
        Object.entries(typeCounts).forEach(([type, count]) => {
            const refsForType = refs[type as keyof typeof refs];
            if (refsForType[0].current) {
                refsForType[0].current.count = count;
            }
            if (refsForType[1].current) {
                refsForType[1].current.count = count;
            }
        });
        
        const dummy = new Object3D();
        const counts: Record<string, number> = {
            tall_grass_1: 0, tall_grass_2: 0, tall_grass_3: 0, dandelion: 0, rose: 0
        };

        if (positions) {
            positions.forEach((pos) => {
                const t = pos.type as keyof typeof refs;
                if (!refs[t]) return;
                
                dummy.position.set(pos.x, pos.y, pos.z);
                const rotY = Math.PI / 4;
                
                dummy.rotation.set(0, rotY, 0);
                dummy.updateMatrix();
                if (refs[t][0].current) refs[t][0].current!.setMatrixAt(counts[t], dummy.matrix);
                
                dummy.rotation.set(0, rotY + Math.PI / 2, 0);
                dummy.updateMatrix();
                if (refs[t][1].current) refs[t][1].current!.setMatrixAt(counts[t], dummy.matrix);
                
                counts[t]++;
            });
        }
        
        Object.values(refs).forEach(([r1, r2]) => {
            if (r1.current) {
                r1.current.instanceMatrix.needsUpdate = true;
                if (r1.current.computeBoundingSphere) r1.current.computeBoundingSphere();
            }
            if (r2.current) {
                r2.current.instanceMatrix.needsUpdate = true;
                if (r2.current.computeBoundingSphere) r2.current.computeBoundingSphere();
            }
        });
    }, [positions]);

    const counts: Record<string, number> = {
        tall_grass_1: positions.filter(p => p.type === 'tall_grass_1').length,
        tall_grass_2: positions.filter(p => p.type === 'tall_grass_2').length,
        tall_grass_3: positions.filter(p => p.type === 'tall_grass_3').length,
        dandelion: positions.filter(p => p.type === 'dandelion').length,
        rose: positions.filter(p => p.type === 'rose').length,
    };

    return (
        <group>
            {Object.entries(counts).map(([type, count]) => {
                if (count === 0) return null;
                const texType = type as keyof typeof textures;
                const refsForType = refs[type as keyof typeof refs];
                return (
                    <group key={type}>
                        <instancedMesh ref={refsForType[0]} args={[undefined as any, undefined as any, count]} receiveShadow frustumCulled={false} userData={{ type, isFlora: true }}>
                            <planeGeometry args={[1.414, 1.2]} />
                            <meshStandardMaterial map={textures[texType]} transparent side={2} alphaTest={0.5} roughness={1} />
                        </instancedMesh>
                        <instancedMesh ref={refsForType[1]} args={[undefined as any, undefined as any, count]} receiveShadow frustumCulled={false} userData={{ type, isFlora: true }}>
                            <planeGeometry args={[1.414, 1.2]} />
                            <meshStandardMaterial map={textures[texType]} transparent side={2} alphaTest={0.5} roughness={1} />
                        </instancedMesh>
                    </group>
                );
            })}
        </group>
    );
}
