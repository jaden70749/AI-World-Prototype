import { BackSide, Mesh } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

export function CustomSky() {
  const meshRef = useRef<Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });

  return (
    <mesh ref={meshRef} scale={[400, 400, 400]}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            // When h is near 0 (horizon), it's whiteish. When h > 0.15, it's blue.
            vec3 topColor = vec3(0.45, 0.65, 1.0); // Classic MC sky blue
            vec3 bottomColor = vec3(0.7, 0.85, 1.0); // Lighter blue at horizon
            float mixFactor = smoothstep(-0.05, 0.25, h);
            gl_FragColor = vec4(mix(bottomColor, topColor, mixFactor), 1.0);
          }
        `}
      />
    </mesh>
  );
}
