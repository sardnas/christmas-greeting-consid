import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Center, useTexture, Text3D } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useCallback, useMemo } from 'react';

function GlitterText() {
  const textRef = useRef();
  const particlesRef = useRef();
  const depth = 15;
  const [textVisible, setTextVisible] = useState(false);
  const [textOpacity, setTextOpacity] = useState(0);
  const [particleOpacity, setParticleOpacity] = useState(0.9);
  const materialRef = useRef();
  
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffd700').multiplyScalar(2.2),
    metalness: 0.7,
    roughness: 0.05,
    envMapIntensity: 3.0,
    emissive: new THREE.Color('#ff9500'),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: textOpacity,
  }), [textOpacity]);

  // Create glitter particles with better text formation
  const particleCount = 1000;
  const particles = useMemo(() => {
    const temp = [];
    const textWidth = 6;
    const textHeight = 0.8;
    
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 10;
      
      // Spread particles further away and more evenly
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadRadius = 20 + Math.random() * 15; // Increased spread distance
      const spreadY = (Math.random() - 0.5) * 20; // More vertical spread
      const spreadX = Math.cos(spreadAngle) * spreadRadius;
      const spreadZ = Math.sin(spreadAngle) * spreadRadius;

      temp.push({ 
        position: [x, y, z],
        spread: [spreadX, spreadY, spreadZ],
        scale: 0.015 + Math.random() * 0.02,
        spreadSpeed: 0.008 + Math.random() * 0.012 // Slower spread
      });
    }
    return temp;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Smoother transition timing
  useEffect(() => {
    const showTimer = setTimeout(() => {
      setTextVisible(true);
      
      let particleOpacity = 0.9;
      let textOpacity = 0;
      
      const fadeInterval = setInterval(() => {
        particleOpacity -= 0.015; // Faster particle fade out
        textOpacity += 0.02; // Faster text fade in
        
        setParticleOpacity(Math.max(0, particleOpacity));
        setTextOpacity(Math.min(1, textOpacity));
        
        if (particleOpacity <= 0 && textOpacity >= 1) {
          clearInterval(fadeInterval);
        }
      }, 30); // Shorter interval for faster updates
      
    }, 2000);
    
    return () => clearTimeout(showTimer);
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particles.forEach((particle, i) => {
        const [x, y, z] = particle.position;
        const [sx, sy, sz] = particle.spread;
        
        if (textVisible) {
          // Smoother spread movement
          particle.position[0] += (sx - x) * particle.spreadSpeed;
          particle.position[1] += (sy - y) * particle.spreadSpeed;
          particle.position[2] += (sz - z) * particle.spreadSpeed;
        } else {
          // Initial swirling animation
          particle.position[0] = x + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.1;
          particle.position[1] = y + Math.cos(state.clock.elapsedTime * 0.5 + i) * 0.1;
          particle.position[2] = z + Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.1;
        }

        dummy.position.set(
          particle.position[0],
          particle.position[1],
          particle.position[2]
        );
        dummy.scale.setScalar(particle.scale);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(i, dummy.matrix);
      });
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }

    // Only start text animation after it's fully visible
    if (textRef.current && textVisible && textOpacity >= 1) {
      const time = state.clock.elapsedTime;
      textRef.current.position.y = Math.sin(time * 0.5) * 0.1;
      textRef.current.rotation.y = Math.sin(time * 0.25) * 0.05;
    }

    if (materialRef.current) {
      materialRef.current.time = state.clock.elapsedTime;
    }
  });

  // Split text into three lines
  const text = [
    "Merry Christmas and",
    "a Happy New Year",
    "from Consid"
  ];

  return (
    <>
      <instancedMesh ref={particlesRef} args={[null, null, particleCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshPhysicalMaterial
          color="#FFD700"
          metalness={0.8}
          roughness={0.1}
          transparent
          opacity={particleOpacity}
          emissive="#FFD700"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </instancedMesh>
      
      <Center ref={textRef} visible={true}>
        {text.map((line, lineIndex) => (
          <Text3D
            key={lineIndex}
            font="https://threejs.org/examples/fonts/helvetiker_regular.typeface.json"
            size={0.8}
            height={0.3}
            curveSegments={32}
            bevelEnabled
            bevelThickness={0.03}
            bevelSize={0.02}
            bevelOffset={0}
            bevelSegments={8}
            material={goldMaterial}
            position={[0, 1.2 - lineIndex * 1.2, 0]}
          >
            {line}
          </Text3D>
        ))}
      </Center>
    </>
  );
}

function Lightning({ start, end, thickness = 0.02, color = '#ffffff' }) {
  const points = useRef([]);
  const lineRef = useRef();

  // Generate lightning path
  const generateLightningPoints = useCallback(() => {
    const points = [];
    const segments = 10;
    const noise = 0.3;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(
        start[0] + (end[0] - start[0]) * t + (Math.random() - 0.5) * noise,
        start[1] + (end[1] - start[1]) * t + (Math.random() - 0.5) * noise,
        start[2] + (end[2] - start[2]) * t + (Math.random() - 0.5) * noise
      );
    }
    return new Float32Array(points);
  }, [start, end]);

  useFrame(() => {
    if (lineRef.current && Math.random() > 0.7) {
      points.current = generateLightningPoints();
      lineRef.current.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(points.current, 3)
      );
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={10}
          array={generateLightningPoints()}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={thickness} />
    </line>
  );
}

function LightningEffect() {
  const lightningBolts = [
    { start: [-2, 2, 0], end: [-1, 0, 0] },
    { start: [2, 2, 0], end: [1, 0, 0] },
    { start: [-1.5, 1.5, 0], end: [-0.5, -0.5, 0] },
    { start: [1.5, 1.5, 0], end: [0.5, -0.5, 0] },
  ];

  return (
    <group>
      {lightningBolts.map((bolt, index) => (
        <Lightning
          key={index}
          start={bolt.start}
          end={bolt.end}
          color="#ffeb3b"
          thickness={0.02}
        />
      ))}
    </group>
  );
}

function Snow() {
  const count = 300;
  const mesh = useRef();
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const time = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.005 + Math.random() / 400;
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;

      temp.push({ time, factor, speed, x, y, z });
    }
    return temp;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    particles.forEach((particle, i) => {
      let { time, factor, speed, x, y } = particle;

      time = particle.time += speed;
      const offset = Math.cos(time) + Math.sin(time * 1) / 10;
      const s = Math.cos(time);

      dummy.position.set(
        x + Math.cos((time / 10) * factor) + (Math.sin(time * 1) * factor) / 10,
        y + Math.sin((time / 10) * factor) + (Math.cos(time * 2) * factor) / 10,
        offset
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <circleGeometry args={[0.05, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
    </instancedMesh>
  );
}

function Scene() {
  return (
    <>
      <OrbitControls 
        enableZoom={false}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 2.5}
      />
      
      {/* Lights */}
      <ambientLight intensity={0.08} color="#ffffff" />
      <directionalLight
        position={[10, 5, 5]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight
        position={[-5, 3, 2]}
        intensity={0.4}
        color="#ffe5bd"
      />
      <hemisphereLight
        skyColor="#ffffff"
        groundColor="#000000"
        intensity={0.1}
      />

      {/* Effects */}
      <Snow />
      <GlitterText />
    </>
  );
}

export default function App() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(to bottom, #0a1128, #1a237e)',
      overflow: 'hidden'
    }}>
      <Suspense fallback={<div style={{ color: 'white' }}>Loading...</div>}>
        <Canvas 
          camera={{ position: [0, 0, 8], fov: 50 }}
          shadows
        >
          <fog attach="fog" args={['#0a1128', 5, 15]} />
          <Scene />
        </Canvas>
      </Suspense>
    </div>
  );
}
