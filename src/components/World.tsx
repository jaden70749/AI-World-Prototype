import { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { useGameStore } from '../lib/store';
import { EdgesGeometry, BoxGeometry, LineBasicMaterial } from 'three';

// How many chunks to load in each direction (e.g. 5 means 11x11 chunks)
const MAX_CHUNKS = Math.floor(30000 / 16 / 2); // 937

const ChunkBorder = ({ chunkX, chunkZ }: { chunkX: number, chunkZ: number }) => {
  const lineGeo = useMemo(() => new EdgesGeometry(new BoxGeometry(16, 256, 16)), []);
  const lineMat = useMemo(() => new LineBasicMaterial({ color: 0xff0000, linewidth: 2 }), []);
  
  return (
    <lineSegments 
      geometry={lineGeo} 
      material={lineMat} 
      position={[chunkX * 16 + 8, 0, chunkZ * 16 + 8]} 
    />
  );
};

export function World() {
  const renderDistance = useGameStore(s => s.renderDistance);
  const showDebugBounds = useGameStore(s => s.showDebugBounds);
  const [activeChunks, setActiveChunks] = useState<string[]>([]);
  const targetChunks = useRef<string[]>([]);
  const lastChunk = useRef<{x: number, z: number, dist: number}>({x: Infinity, z: Infinity, dist: -1});

  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / CHUNK_SIZE);
    const cz = Math.floor(camera.position.z / CHUNK_SIZE);

    if (cx !== lastChunk.current.x || cz !== lastChunk.current.z || renderDistance !== lastChunk.current.dist) {
      lastChunk.current = { x: cx, z: cz, dist: renderDistance };
      const newChunks = [];
      for (let x = -renderDistance - 1; x <= renderDistance + 1; x++) {
        for (let z = -renderDistance - 1; z <= renderDistance + 1; z++) {
          // Circular rendering gives a better feel
          if (Math.sqrt(x*x + z*z) <= renderDistance + 1) {
            const chunkX = cx + x;
            const chunkZ = cz + z;
            
            if (chunkX >= -MAX_CHUNKS && chunkX <= MAX_CHUNKS && chunkZ >= -MAX_CHUNKS && chunkZ <= MAX_CHUNKS) {
              newChunks.push(`${chunkX}_${chunkZ}`);
            }
          }
        }
      }
      targetChunks.current = newChunks;
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChunks(prev => {
        const currentSet = new Set(prev);
        const targetSet = new Set(targetChunks.current);
        
        const toKeep = prev.filter(c => targetSet.has(c));
        const toAdd = targetChunks.current.filter(c => !currentSet.has(c));
        
        if (toKeep.length === prev.length && toAdd.length === 0) return prev;
        
        if (toAdd.length > 0) {
            const pcx = lastChunk.current.x;
            const pcz = lastChunk.current.z;
            toAdd.sort((a, b) => {
                const [ax, az] = a.split('_').map(Number);
                const [bx, bz] = b.split('_').map(Number);
                const distA = Math.pow(ax - pcx, 2) + Math.pow(az - pcz, 2);
                const distB = Math.pow(bx - pcx, 2) + Math.pow(bz - pcz, 2);
                return distA - distB;
            });
            // Load chunks in batches of 4
            return [...toKeep, ...toAdd.slice(0, 4)];
        }
        
        return toKeep;
      });
    }, 50); // 20 times per second
    return () => clearInterval(interval);
  }, []);

  return (
    <group>
      {activeChunks.map(id => {
        const [x, z] = id.split('_').map(Number);
        return (
            <group key={id}>
                <Chunk chunkX={x} chunkZ={z} />
                {showDebugBounds && <ChunkBorder chunkX={x} chunkZ={z} />}
            </group>
        );
      })}
    </group>
  );
}
