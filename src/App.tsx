import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CustomSky } from './components/CustomSky';
import { World } from './components/World';
import { Player } from './components/Player';
import { HUD } from './components/HUD';
import { Settings } from './components/Settings';
import { useState, useRef, useMemo, useEffect } from 'react';
import { InstancedMesh, Object3D, Color, Mesh } from 'three';
import { useGameStore } from './lib/store';

function Clouds() {
  const meshRef = useRef<InstancedMesh>(null);
  const { camera } = useThree();
  
  const cloudData = useMemo(() => {
    const data = [];
    const numClouds = 80; // Not too many
    for (let i = 0; i < numClouds; i++) {
        data.push({
            x: (Math.random() - 0.5) * 2000,
            y: 120 + Math.random() * 40, // Different heights
            z: (Math.random() - 0.5) * 2000,
            scaleX: 30 + Math.random() * 50,
            scaleY: 8 + Math.random() * 8, // Flatter, puffier
            scaleZ: 30 + Math.random() * 50,
            speed: 1.5 + Math.random() * 3, // Different speeds
        });
    }
    return data;
  }, []);

  const dummy = useMemo(() => new Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const px = camera.position.x;
    const pz = camera.position.z;

    cloudData.forEach((cloud, i) => {
      cloud.x += cloud.speed * delta;
      
      // Wrap around the player
      if (cloud.x > px + 1000) cloud.x -= 2000;
      if (cloud.x < px - 1000) cloud.x += 2000;
      
      if (cloud.z > pz + 1000) cloud.z -= 2000;
      if (cloud.z < pz - 1000) cloud.z += 2000;

      dummy.position.set(cloud.x, cloud.y, cloud.z);
      dummy.scale.set(cloud.scaleX, cloud.scaleY, cloud.scaleZ);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, cloudData.length]} renderOrder={1}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent={false} fog={true} />
    </instancedMesh>
  );
}

function Sun() {
  const meshRef = useRef<Mesh>(null);
  const { camera } = useThree();
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const sunTexture = useMemo(() => {
     const canvas = canvasRef.current;
     canvas.width = 128;
     canvas.height = 128;
     const ctx = canvas.getContext('2d')!;
     
     // Clear
     ctx.clearRect(0, 0, 128, 128);
     
     // Draw glow
     const gradient = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
     gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
     gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
     gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
     
     ctx.fillStyle = gradient;
     ctx.fillRect(0, 0, 128, 128);
     
     // Draw solid square center
     ctx.fillStyle = '#ffffff';
     ctx.fillRect(44, 44, 40, 40);

     const tex = new THREE.CanvasTexture(canvas);
     tex.magFilter = THREE.NearestFilter;
     return tex;
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      // Move sun relative to camera so it stays in sky
      meshRef.current.position.set(camera.position.x + 300, camera.position.y + 150, camera.position.z + 200);
      meshRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial map={sunTexture} transparent depthWrite={false} fog={false} depthTest={true} />
    </mesh>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const renderDistance = useGameStore(s => s.renderDistance);
  const isUnderwater = useGameStore(s => s.isUnderwater);

  useEffect(() => {
    // Suppress the annoying THREE.PointerLockControls error if it fails
    const onPointerLockError = (e: Event) => {
      e.stopImmediatePropagation();
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (e.reason && e.reason.message && e.reason.message.includes('Pointer lock cannot be acquired')) {
        e.preventDefault(); // Suppress the unhandled rejection
      }
    };
    
    document.addEventListener('pointerlockerror', onPointerLockError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    
    // Auto-start for preview
    const t = setTimeout(() => setStarted(true), 100);
    return () => {
        clearTimeout(t);
        document.removeEventListener('pointerlockerror', onPointerLockError, true);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
    }
  }, []);

  return (
    <div className="w-screen h-screen bg-[#7BB6FF] relative overflow-hidden">
      {isUnderwater && (
        <div className="absolute inset-0 bg-[#004e9c] opacity-50 z-20 pointer-events-none" />
      )}
      {!started && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#5c3a18] text-white p-8 pattern-dirt">
          <div className="absolute inset-0 bg-black/40 z-0"></div>
          <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-4xl font-bold mb-8 tracking-tight font-mono textShadow-custom">Prototype World</h1>
            <button 
              onClick={() => {
                setStarted(true);
                document.body.requestPointerLock();
              }}
              className="bg-[#777] border-t-4 border-l-4 border-zinc-400 border-b-4 border-r-4 border-zinc-800 textShadow-custom text-white font-mono text-xl py-4 px-12 hover:bg-[#888] active:border-t-zinc-800 active:border-l-zinc-800 active:border-b-zinc-400 active:border-r-zinc-400"
            >
              Play Game
            </button>
          </div>
        </div>
      )}

      {started && <HUD />}
      {started && <Settings />}

      <style>{`
        .pattern-dirt {
          background-image: url('data:image/svg+xml;utf8,<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="%23604531" /><rect x="0" y="0" width="16" height="16" fill="%2373563c" /><rect x="16" y="16" width="16" height="16" fill="%23856345" /><rect x="0" y="16" width="16" height="16" fill="%23553d2a" /></svg>');
          background-size: 128px;
          image-rendering: pixelated;
        }
        .textShadow-custom {
          text-shadow: 2px 2px 0px #333;
        }
      `}</style>

      <Canvas shadows camera={{ fov: 85, near: 0.01, far: 500 }}>
        <color attach="background" args={['#bcdcff']} />
        <CustomSky />
        <fog attach="fog" args={['#bcdcff', renderDistance * 16 * 0.4, renderDistance * 16 - 8]} />
        {/* Environment & Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight  
          position={[100, 100, 50]} 
          intensity={0.8}
          color="#ffffff"
          castShadow 
          shadow-mapSize={[1024, 1024]} 
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-bias={-0.0005}
        />
        
        {started && <Player />}
        <World />
        <Clouds />
        <Sun />
      </Canvas>
    </div>
  );
}

