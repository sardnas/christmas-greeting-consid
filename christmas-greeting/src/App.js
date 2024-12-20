import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Center, useTexture, Html } from '@react-three/drei';
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
  const [displayedText, setDisplayedText] = useState(['']);
  const particleCount = 1000;
  const [phase, setPhase] = useState('entry'); // 'entry', 'writing', 'reveal'
  
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(237, 230, 219)').multiplyScalar(2.2),
    metalness: 0.7,
    roughness: 0.05,
    envMapIntensity: 3.0,
    emissive: new THREE.Color('rgb(237, 230, 219)'),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: textOpacity,
  }), [textOpacity]);

  // Keep entry point in bottom right
  const entryPoint = [4, -4, 0];

  // First, let's spread out the gathering area
  const gatherPoint = [-4, 0, 0];
  const gatherSpread = 1.0; // Reduced from 2.0

  // Wave path starts from left side and moves right
  const writingPath = useMemo(() => {
    const points = [];
    const segments = 200;
    
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      // Start from left (-4) and move right (8)
      const x = -4 + t * 16; // Covers the text width
      // More waves to match text length
      const y = Math.sin(t * Math.PI * 8) * 0.5;
      points.push([x, y, 0]);
    }
    return points;
  }, []);

  // Modify particle behavior
  const particles = useMemo(() => {
    const temp = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Calculate relative delay for this particle
      const delayFactor = i / particleCount; // 0 to 1
      
      // Create a more organized initial formation with progressive spread
      const angle = (i / particleCount) * Math.PI * 2;
      // Radius increases with delay - earlier particles are tighter
      const radius = 0.2 + (delayFactor * 0.6); // Start tight (0.2) and grow to 0.8
      
      // Initial position with progressive spread
      const x = entryPoint[0] + Math.cos(angle) * radius;
      const y = entryPoint[1] + Math.sin(angle) * radius;
      const z = entryPoint[2];

      // Store formation parameters with progressive spread
      const formationOffset = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle: angle,
        radius: radius,
        delayFactor: delayFactor // Store for later use
      };

      // Random target positions for final spread
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadRadius = 15 + Math.random() * 25; // Wider spread
      const spreadX = Math.cos(spreadAngle) * spreadRadius;
      const spreadY = Math.sin(spreadAngle) * spreadRadius;
      const spreadZ = (Math.random() - 0.5) * 15;

      temp.push({ 
        position: [x, y, z],
        pathIndex: 0,
        pathSpeed: 0.1 + Math.random() * 0.2,
        spread: [spreadX, spreadY, spreadZ],
        scale: 0.01 + Math.random() * 0.015,
        spreadSpeed: 0.003 + Math.random() * 0.008,
        offset: Math.random() * Math.PI * 2,
        // Earlier particles start sooner
        delay: delayFactor * 1500,
        entryProgress: 0,
        acceleration: 0.01 + Math.random() * 0.015,
        formationOffset,
        spreadFactor: 0.2 + (delayFactor * 0.2) // Later particles spread more
      });
    }
    
    // Sort particles by delay so earlier ones are processed first
    temp.sort((a, b) => a.delay - b.delay);
    
    return temp;
  }, [writingPath]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Smoother transition timing
  useEffect(() => {
    // Start with entry phase
    setTimeout(() => {
      setPhase('writing');
    }, 4500); // Increased from 3000

    setTimeout(() => {
      setPhase('reveal');
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
      
    }, 8000); // Increased from 6000
  }, []);

  // Add more easing functions for natural motion
  const easeOutQuad = (t) => t * (2 - t);
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // Update M-shaped path calculation for double M
  const calculateMPath = (progress, startPoint, endPoint, particle) => {
    // Define control points for double M shape - more centered
    const p1 = startPoint;
    // First M - reduced horizontal spread
    const p2 = [startPoint[0] - 1.2, startPoint[1] + 3];
    const p3 = [startPoint[0] - 2.4, startPoint[1]];
    const p4 = [startPoint[0] - 3.6, startPoint[1] + 3];
    const p5 = [startPoint[0] - 4.8, startPoint[1]];
    // Second M - reduced horizontal spread
    const p6 = [startPoint[0] - 6.0, startPoint[1] + 3];
    const p7 = [startPoint[0] - 7.2, startPoint[1]];
    const p8 = [startPoint[0] - 8.4, startPoint[1] + 3];
    const p9 = [-4, 0]; // End at left side where text begins

    // Split into 8 segments (4 for each M)
    const segment = Math.floor(progress * 8);
    const t = (progress * 8) % 1;

    // Interpolate between points based on segment
    let x, y;
    if (segment === 0) {
      // First M - first upward diagonal
      x = p1[0] + (p2[0] - p1[0]) * t;
      y = p1[1] + (p2[1] - p1[1]) * t;
    } else if (segment === 1) {
      // First M - first downward diagonal
      x = p2[0] + (p3[0] - p2[0]) * t;
      y = p2[1] + (p3[1] - p2[1]) * t;
    } else if (segment === 2) {
      // First M - second upward diagonal
      x = p3[0] + (p4[0] - p3[0]) * t;
      y = p3[1] + (p4[1] - p3[1]) * t;
    } else if (segment === 3) {
      // First M - second downward diagonal
      x = p4[0] + (p5[0] - p4[0]) * t;
      y = p4[1] + (p5[1] - p4[1]) * t;
    } else if (segment === 4) {
      // Second M - first upward diagonal
      x = p5[0] + (p6[0] - p5[0]) * t;
      y = p5[1] + (p6[1] - p5[1]) * t;
    } else if (segment === 5) {
      // Second M - first downward diagonal
      x = p6[0] + (p7[0] - p6[0]) * t;
      y = p6[1] + (p7[1] - p6[1]) * t;
    } else if (segment === 6) {
      // Second M - second upward diagonal
      x = p7[0] + (p8[0] - p7[0]) * t;
      y = p7[1] + (p8[1] - p7[1]) * t;
    } else {
      // Second M - final downward diagonal
      x = p8[0] + (p9[0] - p8[0]) * t;
      y = p8[1] + (p9[1] - p8[1]) * t;
    }

    // Add formation-based offset
    const formationScale = 1 - Math.pow(progress, 3) * 0.3;
    return [
      x + particle.formationOffset.x * formationScale,
      y + particle.formationOffset.y * formationScale
    ];
  };

  useFrame((state) => {
    if (particlesRef.current) {
      particles.forEach((particle, i) => {
        const time = state.clock.elapsedTime;

        if (phase === 'entry' || (phase === 'writing' && particle.entryProgress < 1)) {
          // Individual acceleration for each particle
          if (time * 1000 > particle.delay) {
            particle.entryProgress = Math.min(1, 
              particle.entryProgress + 0.003 + 
              particle.entryProgress * (particle.acceleration * 0.3)
            );
            const progress = easeInOutCubic(particle.entryProgress);
            
            const [pathX, pathY] = calculateMPath(
              progress,
              entryPoint,
              writingPath[0], // Use wave path start point
              particle
            );
            
            // Smooth transition near the end of MM path
            if (progress > 0.95) { // Shorter transition window
              const transitionProgress = (progress - 0.95) / 0.05;
              const eased = easeInOutCubic(transitionProgress);
              
              // Calculate the wave starting position maintaining formation
              const waveStartIndex = 0;
              const formationScale = 0.5;
              
              // Get particle's position in the wave formation
              const waveOffset = {
                x: particle.formationOffset.x * formationScale,
                y: particle.formationOffset.y * formationScale
              };
              
              // Blend MM path end with wave path start
              particle.position[0] = pathX + (writingPath[waveStartIndex][0] + waveOffset.x - pathX) * eased;
              particle.position[1] = pathY + (writingPath[waveStartIndex][1] + waveOffset.y - pathY) * eased;
              particle.position[2] = entryPoint[2];

              // Pre-initialize wave phase properties for smooth transition
              particle.pathIndex = 0;
              particle.waveOffset = waveOffset;
            } else {
              particle.position[0] = pathX;
              particle.position[1] = pathY;
              particle.position[2] = entryPoint[2];
            }
          }
        } else if (phase === 'writing') {
          // Get base wave position
          const baseIndex = Math.floor(particle.pathIndex);
          const nextIndex = (baseIndex + 1) % writingPath.length;
          const t = particle.pathIndex - baseIndex;
          
          // Interpolate between wave points
          const currentPoint = writingPath[baseIndex];
          const nextPoint = writingPath[nextIndex];
          const x = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * t;
          const y = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * t;
          
          // Add formation offset and flow
          const flowOffset = Math.sin(time * 2 + particle.formationOffset.angle) * 0.1;
          particle.position[0] = x + particle.waveOffset.x + flowOffset;
          particle.position[1] = y + particle.waveOffset.y;
          particle.position[2] = currentPoint[2];
          
          // Update path index with smooth looping
          particle.pathIndex += particle.pathSpeed;
          if (particle.pathIndex >= writingPath.length) {
            particle.pathIndex = 0;
          }
        } else if (phase === 'reveal') {
          // More natural spread behavior
          const [x, y, z] = particle.position;
          const [sx, sy, sz] = particle.spread;
          const spreadProgress = easeOutBack(particle.spreadProgress || 0);
          particle.spreadProgress = Math.min(1, (particle.spreadProgress || 0) + 0.01);
          
          particle.position[0] += (sx - x) * particle.spreadSpeed * (1 - spreadProgress);
          particle.position[1] += (sy - y) * particle.spreadSpeed * (1 - spreadProgress);
          particle.position[2] += (sz - z) * particle.spreadSpeed * (1 - spreadProgress);
        }

        // Update particle matrix
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

    // Update text animation with wavy motion
    if (textRef.current && textVisible && textOpacity >= 1) {
      const time = state.clock.elapsedTime;
      // Vertical wave motion
      textRef.current.position.y = Math.sin(time * 0.8) * 0.15;
      // Slight horizontal wave motion
      textRef.current.position.x = Math.sin(time * 0.5) * 0.1;
      // Gentle rotation
      textRef.current.rotation.y = Math.sin(time * 0.3) * 0.08;
    }

    if (materialRef.current) {
      materialRef.current.time = state.clock.elapsedTime;
    }
  });

  // Split text into single line
  const text = [
    "Merry Christmas from Consid",
  ];

  // Simplified letter-by-letter animation
  useEffect(() => {
    if (textVisible) {
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        setDisplayedText(prev => {
          if (currentIndex >= text[0].length) {
            clearInterval(interval);
            return prev;
          }
          
          return [text[0].slice(0, currentIndex + 1)];
        });
        currentIndex++;
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [textVisible]);

  return (
    <>
      <instancedMesh ref={particlesRef} args={[null, null, particleCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshPhysicalMaterial
          color="rgb(237, 230, 219)"
          metalness={0.8}
          roughness={0.1}
          transparent
          opacity={particleOpacity}
          emissive="rgb(237, 230, 219)"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </instancedMesh>
      
      <Center ref={textRef} visible={true}>
        <Html transform>
          {displayedText.map((line, lineIndex) => (
            <div
              key={lineIndex}
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '30px',
                fontWeight: '700',
                color: 'rgb(237, 230, 219)',
                textAlign: 'center',
                marginBottom: '15px',
                textShadow: '0 0 10px rgb(237, 230, 219)',
                whiteSpace: 'nowrap',
                opacity: textOpacity
              }}
            >
              {line}
            </div>
          ))}
        </Html>
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
      background: 'linear-gradient(to bottom, rgb(112, 17, 49), rgb(82, 12, 36))',
      overflow: 'hidden'
    }}>
      <Suspense fallback={<div style={{ color: 'white' }}>Loading...</div>}>
        <Canvas 
          camera={{ position: [0, 0, 8], fov: 50 }}
          shadows
        >
          <fog attach="fog" args={['rgb(112, 17, 49)', 5, 15]} />
          <Scene />
        </Canvas>
      </Suspense>
    </div>
  );
}
