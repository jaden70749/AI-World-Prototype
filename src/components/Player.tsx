import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { Vector3, Quaternion, Euler, Raycaster, MeshBasicMaterial, Mesh, Matrix4, InstancedMesh, Group, Vector2 } from 'three';
import { getElevation, WATER_LEVEL, checkIsTree, getBiomeInfo } from '../lib/noise';
import { breakBlock, useGameStore, isBlockBroken, placedBlocks } from '../lib/store';
import { createTexture } from '../lib/textures';

const WALK_SPEED = 3.0; // Slower walk speed
const SPRINT_SPEED = 4.8;
const FLY_SPEED = 10.9;
const SNEAK_SPEED = 1.3;
const GRAVITY = 30;
const JUMP_FORCE = 8.5;

// Simple audio synthesis for dig/break sound
function playDigSound() {
    try {
        const audioCtx = new (window.AudioContext || (window as unknown as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(60 + Math.random() * 40, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
}

const HARDNESS: Record<string, number> = {
  leaves: 0.15,
  sand: 0.4,
  dirt: 0.5,
  grass: 0.5,
  tall_grass: 0,
  dandelion: 0,
  rose: 0,
  wood: 1.5,
  stone: 1.5,
  water: Infinity,
  bedrock: Infinity
};

const breakStageTextures = [
    createTexture('break_stage_1', [(ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0,0,16,16);
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(4,6); ctx.lineTo(2,10);
        ctx.moveTo(16,0); ctx.lineTo(12,4); ctx.lineTo(13,8);
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.stroke();
    }]),
    createTexture('break_stage_2', [(ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,16,16);
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(4,6); ctx.lineTo(2,10); ctx.lineTo(6,16);
        ctx.moveTo(16,0); ctx.lineTo(12,4); ctx.lineTo(13,8); ctx.lineTo(8,12);
        ctx.moveTo(3,3); ctx.lineTo(8,8); ctx.lineTo(12,6);
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.stroke();
    }]),
    createTexture('break_stage_3', [(ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0,0,16,16);
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(4,6); ctx.lineTo(2,10); ctx.lineTo(6,16);
        ctx.moveTo(16,0); ctx.lineTo(12,4); ctx.lineTo(13,8); ctx.lineTo(8,12);
        ctx.moveTo(3,3); ctx.lineTo(8,8); ctx.lineTo(12,6);
        ctx.moveTo(4,14); ctx.lineTo(10,10); ctx.lineTo(14,16);
        ctx.moveTo(0,12); ctx.lineTo(5,8); ctx.lineTo(8,2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }])
];

function BreakingOverlay() {
    const meshRef = useRef<Mesh>(null);
    
    useFrame(() => {
        if (!meshRef.current) return;
        const state = useGameStore.getState();
        const miningTarget = state.miningTarget;
        const miningProgress = state.miningProgress;

        if (!miningTarget || miningProgress <= 0) {
            meshRef.current.visible = false;
            return;
        }
        meshRef.current.visible = true;
        meshRef.current.position.set(miningTarget.x, miningTarget.y, miningTarget.z);
        
        let stage = 0;
        if (miningProgress > 0.33) stage = 1;
        if (miningProgress > 0.66) stage = 2;
        
        const mat = meshRef.current.material as MeshBasicMaterial;
        mat.map = breakStageTextures[stage];
        mat.needsUpdate = true;
    });
    
    return (
        <mesh ref={meshRef} visible={false} scale={[1.02, 1.02, 1.02]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial transparent opacity={0.8} />
        </mesh>
    );
}

function PlayerBody() {
  const { camera } = useThree();
  const bodyRef = useRef<Group>(null);
  
  useFrame(() => {
    if (!bodyRef.current) return;
    
    // Move body backwards/down so it doesn't clip the camera much
    bodyRef.current.position.copy(camera.position);
    bodyRef.current.position.y -= 0.6; // lower
    
    // Y-rotation matches camera yaw, NOT pitch. 
    const euler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    bodyRef.current.rotation.set(0, euler.y, 0);
    // Push the group slightly backwards locally
    bodyRef.current.translateZ(0.2);
  });
  
  return (
    <group ref={bodyRef}>
      {/* Torso */}
      <mesh position={[0, -0.7, 0]} castShadow>
        <boxGeometry args={[0.6, 0.8, 0.3]} />
        <meshStandardMaterial color="#00aaff" roughness={0.8} />
      </mesh>
      
      {/* Left Arm */}
      <mesh position={[-0.45, -0.7, 0]} castShadow>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color="#c68f6e" roughness={0.8} />
      </mesh>
      
      {/* Right Arm (Idle body arm, player hand replaces it in first person view? Let's just have it here, it will be behind the camera attached hand) */}
      <mesh position={[0.45, -0.7, 0]} castShadow>
         <boxGeometry args={[0.3, 0.8, 0.3]} />
         <meshStandardMaterial color="#c68f6e" roughness={0.8} />
      </mesh>
      
      {/* Legs */}
      <mesh position={[-0.15, -1.5, 0]} castShadow>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color="#2d42a8" roughness={0.8} />
      </mesh>
      <mesh position={[0.15, -1.5, 0]} castShadow>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color="#2d42a8" roughness={0.8} />
      </mesh>
    </group>
  );
}

function PlayerHand() {
  const { camera } = useThree();
  const handRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!handRef.current) return;
    const miningProgress = useGameStore.getState().miningProgress;
    
    // Default position relative to camera
    const time = state.clock.getElapsedTime();
    let xOffset = 0.5;
    let yOffset = -0.4;
    let zOffset = -0.5;
    let rotX = -0.5;
    
    // Idle bobbing
    yOffset += Math.sin(time * 2) * 0.02;
    
    // Mining animation
    if (miningProgress > 0) {
        rotX -= Math.sin(miningProgress * Math.PI * 4) * 0.5;
        zOffset -= Math.sin(miningProgress * Math.PI * 4) * 0.3;
        yOffset += Math.sin(miningProgress * Math.PI * 4) * 0.2;
    }
    
    // Apply camera rotation to offset
    const offset = new Vector3(xOffset, yOffset, zOffset);
    offset.applyQuaternion(camera.quaternion);
    
    handRef.current.position.copy(camera.position).add(offset);
    
    // Apply camera rotation + hand rotation
    const handQuat = new Quaternion().setFromEuler(new Euler(rotX, 0.2, 0));
    handRef.current.quaternion.copy(camera.quaternion).multiply(handQuat);
  });

  return (
    <mesh ref={handRef} castShadow>
      <boxGeometry args={[0.2, 0.6, 0.2]} />
      <meshStandardMaterial color="#c68f6e" roughness={0.8} />
    </mesh>
  );
}

export function Player() {
  const { camera, scene, gl } = useThree();
  const velocity = useRef(new Vector3());
  const position = useRef(new Vector3(0, 200, 0)); // Will be instantly snapped to ground
  const keys = useRef<Record<string, boolean>>({});
  const hasInitializedSpawn = useRef(false);
  
  const lastWPress = useRef(0);
  const isSprinting = useRef(false);
  const lastSpacePress = useRef(0);
  const isFlying = useRef(false);
  const creativeMode = useGameStore(s => s.creativeMode);
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen);
  const setInventoryOpen = useGameStore(s => s.setInventoryOpen);
  const setHotbarIndex = useGameStore(s => s.setHotbarIndex);
  const setIsUnderwater = useGameStore(s => s.setIsUnderwater);
  const isMouseDown = useRef(false);
  const currentMiningTarget = useRef<{x: number, y: number, z: number, type: string} | null>(null);
  const targetProgress = useRef(0);
  const isUnderwaterRef = useRef(false);

  useEffect(() => {
    isFlying.current = creativeMode ? isFlying.current : false;
  }, [creativeMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      
      const now = performance.now();

      // Flying toggle (Double tap Space)
      if (e.code === 'Space' && creativeMode) {
        if (now - lastSpacePress.current < 300) {
          isFlying.current = !isFlying.current;
        }
        lastSpacePress.current = now;
      }

      // UI Keys
      if (e.code === 'KeyE') {
        const state = useGameStore.getState();
        if (state.inventoryOpen) {
           state.setInventoryOpen(false);
           document.body.requestPointerLock();
        } else {
           state.setInventoryOpen(true);
           document.exitPointerLock();
        }
      }
      if (e.code === 'Escape') {
        // PointerLockControls handles unlocking, we just need to show settings
        setSettingsOpen(true);
      }
      if (e.code.startsWith('Digit')) {
        const digit = parseInt(e.code.replace('Digit', ''));
        if (digit >= 1 && digit <= 9) {
          setHotbarIndex(digit - 1);
        }
      }
      if (e.code === 'Minus') {
        const state = useGameStore.getState();
        state.setShowDebugBounds(!state.showDebugBounds);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.code === 'KeyW' || e.code === 'ShiftLeft') {
        isSprinting.current = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
        // Allow interaction if pointer locked or if clicked on the canvas
        if (document.pointerLockElement || e.target === gl.domElement) {
            if (e.button === 0) { // Left click
                isMouseDown.current = true;
            } else if (e.button === 2) { // Right click
                const state = useGameStore.getState();
                const selectedItem = state.inventory[state.hotbarIndex];
                
                if ((selectedItem && selectedItem.count > 0) || state.creativeMode) {
                    const blockTypeToPlace = selectedItem && selectedItem.type ? selectedItem.type : 'stone';
                    
                    const raycaster = new Raycaster();
                    raycaster.setFromCamera(new Vector2(0, 0), camera);
                    const intersects = raycaster.intersectObjects(scene.children, true);
                    const hit = intersects.find(obj => (obj.object as any).isInstancedMesh && obj.object.userData.type !== 'water' && obj.object.userData.type !== 'cloud' && !obj.object.userData.isFlora);
                    
                    if (hit && hit.distance < (state.creativeMode ? 6 : 4.5)) {
                        const instancedMesh = hit.object as InstancedMesh;
                        if (hit.instanceId !== undefined && hit.face) {
                            const matrix = new Matrix4();
                            instancedMesh.getMatrixAt(hit.instanceId, matrix);
                            const pos = new Vector3().setFromMatrixPosition(matrix);
                            const bx = Math.round(pos.x);
                            const by = Math.round(pos.y);
                            const bz = Math.round(pos.z);
                            
                            const normal = hit.face.normal.clone().transformDirection(instancedMesh.matrixWorld).normalize();
                            const placeX = bx + Math.round(normal.x);
                            const placeY = by + Math.round(normal.y);
                            const placeZ = bz + Math.round(normal.z);
                            
                            // Prevent placing inside player
                            const pX = Math.round(position.current.x);
                            const pY = Math.round(position.current.y);
                            const pZ = Math.round(position.current.z);
                            const isInsidePlayer = placeX === pX && placeZ === pZ && (placeY === pY || placeY === pY - 1);
                            
                            if (!isInsidePlayer) {
                                import('../lib/store').then(({ placeBlock, breakBlock }) => {
                                    // Make sure nothing else is there (e.g. natural flora that we didn't raycast against)
                                    breakBlock(placeX, placeY, placeZ);
                                    placeBlock(placeX, placeY, placeZ, blockTypeToPlace);
                                    if (!state.creativeMode && selectedItem) {
                                        state.removeFromInventory(blockTypeToPlace, 1);
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
            isMouseDown.current = false;
            targetProgress.current = 0;
            currentMiningTarget.current = null;
            useGameStore.getState().setMiningTarget(null);
            useGameStore.getState().setMiningProgress(0);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [camera, scene, creativeMode, setSettingsOpen, setInventoryOpen, setHotbarIndex]);

  useFrame((_, delta) => {
    // Handle Block Breaking logic
    if (isMouseDown.current) {
        const raycaster = new Raycaster();
        raycaster.setFromCamera(new Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        let hitBlock: {x: number, y: number, z: number, type: string} | null = null;
        
        if (intersects.length > 0) {
            const hit = intersects.find(obj => (obj.object as any).isInstancedMesh && obj.object.userData.type !== 'water' && obj.object.userData.type !== 'cloud');
            if (hit && hit.distance < (creativeMode ? 6 : 4.5)) { // Mining reach
                const instancedMesh = hit.object as InstancedMesh;
                if (hit.instanceId !== undefined) {
                    const matrix = new Matrix4();
                    instancedMesh.getMatrixAt(hit.instanceId, matrix);
                    const pos = new Vector3().setFromMatrixPosition(matrix);
                    const bx = Math.round(pos.x);
                    const by = Math.round(pos.y);
                    const bz = Math.round(pos.z);
                    const type = instancedMesh.userData.type || 'stone';
                    hitBlock = { x: bx, y: by, z: bz, type };
                }
            }
        }
        
        if (hitBlock) {
            const isSameTarget = currentMiningTarget.current && 
                currentMiningTarget.current.x === hitBlock.x && 
                currentMiningTarget.current.y === hitBlock.y && 
                currentMiningTarget.current.z === hitBlock.z;

            if (!isSameTarget) {
                // New target or target changed
                currentMiningTarget.current = hitBlock;
                targetProgress.current = 0;
            } else {
                // Same target, continue progress
                targetProgress.current += delta;
            }

            const hardness = HARDNESS[currentMiningTarget.current.type] !== undefined ? HARDNESS[currentMiningTarget.current.type] : 1;
            const timeToBreak = creativeMode ? 0 : hardness;
            
            if (timeToBreak === 0 || targetProgress.current >= timeToBreak) {
                if (currentMiningTarget.current.type !== 'water' && currentMiningTarget.current.type !== 'bedrock') {
                    breakBlock(currentMiningTarget.current.x, currentMiningTarget.current.y, currentMiningTarget.current.z);
                    useGameStore.getState().addToInventory(currentMiningTarget.current.type, 1);
                    playDigSound();
                    targetProgress.current = 0;
                    currentMiningTarget.current = null;
                    useGameStore.getState().setMiningTarget(null);
                    useGameStore.getState().setMiningProgress(0);
                }
            } else {
                const normalizedProgress = targetProgress.current / timeToBreak;
                useGameStore.getState().setMiningProgress(normalizedProgress);
                useGameStore.getState().setMiningTarget({ x: currentMiningTarget.current.x, y: currentMiningTarget.current.y, z: currentMiningTarget.current.z });
            }
        } else {
            // Looking at air
            targetProgress.current = 0;
            currentMiningTarget.current = null;
            useGameStore.getState().setMiningTarget(null);
            useGameStore.getState().setMiningProgress(0);
        }
    }

    const state = keys.current;
    
    // Determine target speed
    const direction = new Vector3();

    let targetSpeed = WALK_SPEED;
    if (isFlying.current) targetSpeed = FLY_SPEED;
    else if (state['ShiftLeft'] && (state['KeyW'] || state['ArrowUp'])) targetSpeed = SPRINT_SPEED;
    else if (state['ControlLeft']) targetSpeed = SNEAK_SPEED;
    if (state['KeyW'] || state['ArrowUp']) direction.z -= 1;
    if (state['KeyS'] || state['ArrowDown']) direction.z += 1;
    if (state['KeyA'] || state['ArrowLeft']) direction.x -= 1;
    if (state['KeyD'] || state['ArrowRight']) direction.x += 1;
    
    direction.normalize();
    
    const euler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    euler.x = 0; 
    euler.z = 0;
    const quat = new Quaternion().setFromEuler(euler);
    
    direction.applyQuaternion(quat);
    direction.multiplyScalar(targetSpeed * delta);

    // Get current ground height
    const blockX = Math.round(position.current.x);
    const blockZ = Math.round(position.current.z);
    
    // Simple custom function to get actual physical ground height including broken blocks
    const isBlockSolid = (bx: number, by: number, bz: number) => {
        if (placedBlocks.has(`${bx}_${by}_${bz}`)) {
            const blockType = placedBlocks.get(`${bx}_${by}_${bz}`);
            if (blockType !== 'water') return true;
        }
        if (isBlockBroken(bx, by, bz)) return false;
        
        // Tree check
        for (let tx = bx - 2; tx <= bx + 2; tx++) {
            for (let tz = bz - 2; tz <= bz + 2; tz++) {
                if (checkIsTree(tx, tz)) {
                    const trunkNoise = Math.abs((Math.sin(tx * 12.9898 + tz * 78.233) * 43758.5453) % 1);
                    const trunkHeight = 4 + Math.floor((trunkNoise * 10) % 3);
                    const th = Math.floor(getElevation(tx, tz));
                    
                    const dx = Math.abs(bx - tx);
                    const dz = Math.abs(bz - tz);
                    
                    if (dx === 0 && dz === 0 && by > th && by <= th + trunkHeight) return true;
                    
                    const lly = by - th;
                    if (lly >= trunkHeight - 1 && lly <= trunkHeight + 1) {
                        if (dx === 2 && dz === 2) continue;
                        if (lly === trunkHeight + 1 && (dx > 1 || dz > 1)) continue;
                        if (dx === 0 && dz === 0 && lly <= trunkHeight) continue;
                        return true;
                    }
                }
            }
        }
        
        const h = Math.floor(getElevation(bx, bz));
        if (by <= h) return true;
        
        return false;
    };

    const getTopBlockHeight = (bx: number, bz: number) => {
        for (let y = 100; y >= -20; y--) {
            if (isBlockSolid(bx, y, bz)) return y + 0.5;
        }
        return Math.floor(getElevation(bx, bz)) + 0.5;
    };

    const currentY = position.current.y;
    const height = 1.5; // Player eye height

    // Instantly snap to ground on first frame
    if (!hasInitializedSpawn.current) {
        let spawnX = 0;
        let spawnZ = 0;
        let sGround = getTopBlockHeight(spawnX, spawnZ);
        // Find a suitable spawn that isn't water
        while (sGround <= WATER_LEVEL + 0.5) {
            spawnX += 5;
            spawnZ += 5;
            sGround = getTopBlockHeight(spawnX, spawnZ);
        }
        position.current.set(spawnX, sGround + height, spawnZ); // Exact height, no 0.1 gap
        camera.position.copy(position.current);
        hasInitializedSpawn.current = true;
        return;
    }

    // Apply horizontal movement with simple collision padding
    const PADDING = 0.3;
    
    // We check X and Z axis independently to allow wall sliding
    if (!isFlying.current) {
        const feetY = position.current.y - height;
        const nextBlockFeetY = Math.floor(feetY + 0.1); 
        const nextBlockBodyY = Math.floor(feetY + 1.1);
        
        if (direction.x !== 0) {
            const nextX = position.current.x + direction.x + Math.sign(direction.x) * PADDING;
            const nextBlockX = Math.round(nextX);
            const currentBlockZ = Math.round(position.current.z);
            
            let collisionX = false;
            if (isBlockSolid(nextBlockX, nextBlockFeetY, currentBlockZ)) {
                if (!isBlockSolid(nextBlockX, nextBlockFeetY + 1, currentBlockZ) && !isBlockSolid(nextBlockX, nextBlockFeetY + 2, currentBlockZ)) {
                    // can step up
                } else {
                    collisionX = true;
                }
            }
            if (isBlockSolid(nextBlockX, nextBlockBodyY, currentBlockZ)) collisionX = true;
            if (collisionX) direction.x = 0;
        }
        
        if (direction.z !== 0) {
            const nextZ = position.current.z + direction.z + Math.sign(direction.z) * PADDING;
            const currentBlockX = Math.round(position.current.x);
            const nextBlockZ = Math.round(nextZ);
            
            let collisionZ = false;
            if (isBlockSolid(currentBlockX, nextBlockFeetY, nextBlockZ)) {
                if (!isBlockSolid(currentBlockX, nextBlockFeetY + 1, nextBlockZ) && !isBlockSolid(currentBlockX, nextBlockFeetY + 2, nextBlockZ)) {
                    // can step up
                } else {
                    collisionZ = true;
                }
            }
            if (isBlockSolid(currentBlockX, nextBlockBodyY, nextBlockZ)) collisionZ = true;
            if (collisionZ) direction.z = 0;
        }
        
        // Ceiling collision
        if (velocity.current.y > 0) {
            const headY = position.current.y + 0.2;
            const nextHeadY = headY + velocity.current.y * delta;
            const hx = Math.round(position.current.x);
            const hz = Math.round(position.current.z);
            if (isBlockSolid(hx, Math.floor(nextHeadY), hz)) {
                velocity.current.y = 0;
                position.current.y = Math.floor(nextHeadY) - 0.2;
            }
        }
    }

    position.current.x += direction.x;
    position.current.z += direction.z;
    
    // Smooth stepping when walking onto land from water, or just general stepping
    const currentBlockX = Math.round(position.current.x);
    const currentBlockZ = Math.round(position.current.z);
    
    const feetY = position.current.y - height;
    let groundY = -256;
    for (let y = Math.floor(feetY + 1.0); y >= Math.floor(feetY - 20); y--) {
        if (isBlockSolid(currentBlockX, y, currentBlockZ)) {
            groundY = y + 0.5;
            break;
        }
    }
    
    // Check if water naturally exists here and surface isn't broken
    const originalH = Math.floor(getElevation(currentBlockX, currentBlockZ));
    const hasOcean = originalH < WATER_LEVEL && !isBlockBroken(currentBlockX, WATER_LEVEL, currentBlockZ);
    const inWater = hasOcean && position.current.y - height <= WATER_LEVEL + 0.5;

    if (isFlying.current) {
        velocity.current.y = 0;
        if (state['Space']) position.current.y += FLY_SPEED * delta;
        if (state['ControlLeft']) position.current.y -= FLY_SPEED * delta;
    } else if (inWater) {
        // Swimming physics
        velocity.current.y -= (GRAVITY * 0.05) * delta; // Much lower gravity in water
        if (velocity.current.y < -2) velocity.current.y = -2; // Terminal velocity in water
        
        if (state['Space']) {
            // Apply jump force if they are near the surface to hop out
            if (position.current.y >= WATER_LEVEL + 0.5) {
                velocity.current.y = JUMP_FORCE;
            } else {
                velocity.current.y += 15 * delta; // Swim up
                if (velocity.current.y > 3) velocity.current.y = 3;
            }
        }
        
        // Let them move horizontally if not blocked
        position.current.x -= direction.x * 0.2; // just 20% friction
        position.current.z -= direction.z * 0.2;
    } else {
        if (position.current.y <= groundY + height + 0.1) {
          // On ground
          if (state['Space']) {
            velocity.current.y = JUMP_FORCE;
          } else {
            // Smoothly snap to ground if we step up/down slightly
            velocity.current.y = 0;
            // Linear interpolation for stepping up/down
            position.current.y += (groundY + height - position.current.y) * 15 * delta;
            
            // Sneak prevents walking off edges (not full implementation, but stops Y drop)
            if (state['ControlLeft'] && groundY + height < position.current.y - 0.5) {
                position.current.x -= direction.x;
                position.current.z -= direction.z;
            }
          }
        } else {
          // Falling
          velocity.current.y -= GRAVITY * delta;
        }
    }
    
    position.current.y += velocity.current.y * delta;
    
    // Hard fallback ground check
    if (!isFlying.current && position.current.y < groundY + height) {
      position.current.y = groundY + height;
      velocity.current.y = 0;
    }

    camera.position.copy(position.current);

    const cameraBlockX = Math.round(camera.position.x);
    const cameraBlockZ = Math.round(camera.position.z);
    const camOriginalH = Math.floor(getElevation(cameraBlockX, cameraBlockZ));
    const camHasOcean = camOriginalH < WATER_LEVEL && !isBlockBroken(cameraBlockX, WATER_LEVEL, cameraBlockZ);

    if (camHasOcean && camera.position.y <= WATER_LEVEL + 0.5) {
        if (!isUnderwaterRef.current) {
            isUnderwaterRef.current = true;
            setIsUnderwater(true);
        }
    } else {
        if (isUnderwaterRef.current) {
            isUnderwaterRef.current = false;
            setIsUnderwater(false);
        }
    }

    const coordsOverlay = document.getElementById('coords-overlay');
    if (coordsOverlay && coordsOverlay.style.display !== 'none') {
        const cx = camera.position.x;
        const cy = camera.position.y;
        const cz = camera.position.z;
        const bx = Math.floor(cx);
        const by = Math.floor(cy);
        const bz = Math.floor(cz);
        const chunkX = Math.floor(cx / 16);
        const chunkZ = Math.floor(cz / 16);
        
        // Calculate facing
        const dir = new Vector3();
        camera.getWorldDirection(dir);
        let facingName = 'unknown';
        if (Math.abs(dir.x) > Math.abs(dir.z)) {
            facingName = dir.x > 0 ? 'east (Towards positive X)' : 'west (Towards negative X)';
        } else {
            facingName = dir.z > 0 ? 'south (Towards positive Z)' : 'north (Towards negative Z)';
        }

        const { isForest, isMountain } = getBiomeInfo(cx, cz);
        let biomeStr = 'minecraft:plains';
        if (isForest) biomeStr += ' (Forest)';
        else if (isMountain) biomeStr += ' (Mountain)';
        else biomeStr += ' (Plains)';

        const stats = [
            `Minecraft 1 (1.0/vanilla) - Clone`,
            `XYZ: ${cx.toFixed(3)} / ${cy.toFixed(5)} / ${cz.toFixed(3)}`,
            `Block: ${bx} ${by} ${bz}`,
            `Chunk: ${bx & 15} ${by & 15} ${bz & 15} in ${chunkX} ${Math.floor(by/16)} ${chunkZ}`,
            `Facing: ${facingName} (${dir.x.toFixed(1)} / ${dir.z.toFixed(1)})`,
            `Biome: ${biomeStr}`
        ];
        
        coordsOverlay.innerText = stats.join('\n');
    }
  });

  return (
    <>
      <PointerLockControls makeDefault />
      <BreakingOverlay />
      <PlayerBody />
      <PlayerHand />
    </>
  );
}
