import { Suspense, useState, useEffect, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Center, useTexture, Html } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useCallback, useMemo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import helvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json';

function GlitterText() {
  const textRef = useRef();
  const particlesRef = useRef();
  const depth = 15;
  const [particleOpacity, setParticleOpacity] = useState(0.9);
  const materialRef = useRef();
  const particleCount = 1000;
  const [phase, setPhase] = useState('entry'); // 'entry', 'writing', 'reveal'
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [maxProgress, setMaxProgress] = useState(0);
  
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(237, 230, 219)').multiplyScalar(2.2),
    metalness: 0.7,
    roughness: 0.05,
    envMapIntensity: 3.0,
    emissive: new THREE.Color('rgb(237, 230, 219)'),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 1,
  }), []);

  // Keep entry point in bottom right
  const entryPoint = [4, -4, 0];

  // First, let's spread out the gathering area
  const gatherPoint = [-4, 0, 0];
  const gatherSpread = 1.0; // Reduced from 2.0

  // First, extend the wave path even more
  const writingPath = useMemo(() => {
    const points = [];
    const segments = 200;
    
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      // Extended range further to ensure full text width
      const x = -4 + t * 30; // Increased from 24 to 30 for wider range
      const y = Math.sin(t * Math.PI * 8) * 0.5;
      points.push([x, y, 0]);
    }
    return points;
  }, []);

  // First, let's define the sparkle colors at the top level of GlitterText
  const sparkleColors = [
    {
      color: 'rgb(255, 255, 255)',
      emissive: 'rgb(255, 255, 255)',
      metalness: 0.9,
    }
  ];

  // Then update the particle initialization
  const particles = useMemo(() => {
    const temp = [];
    
    for (let i = 0; i < particleCount; i++) {
      const delayFactor = i / particleCount;
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.2 + (delayFactor * 0.6);
      
      const x = entryPoint[0] + Math.cos(angle) * radius;
      const y = entryPoint[1] + Math.sin(angle) * radius;
      const z = entryPoint[2];

      // Assign a random color from our sparkle colors
      const colorScheme = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];

      temp.push({ 
        position: [x, y, z],
        scale: 0.01 + Math.random() * 0.01,
        delay: delayFactor * 1500,
        entryProgress: 0,
        acceleration: 0.01 + Math.random() * 0.015,
        formationOffset: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          angle,
          radius,
          delayFactor
        },
        individualPhase: 'entry',
        baseColor: colorScheme.color, // Store the base color
        sparkleSpeed: 0.8 + Math.random() * 1.5,
        sparklePhase: Math.random() * Math.PI * 2
      });
    }
    
    return temp.sort((a, b) => a.delay - b.delay);
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Smoother transition timing
  useEffect(() => {
    // Start with entry phase
    setTimeout(() => {
      setPhase('writing');
    }, 4500);
  }, []);

  // Add more easing functions for natural motion
  const easeOutQuad = (t) => t * (2 - t);
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // Add a smoothing helper function
  const smoothstep = (x) => {
    return x * x * (3 - 2 * x);
  };

  // Update the MM path calculation for smoother corners
  const calculateMPath = (progress, startPoint, endPoint, particle) => {
    // Keep same control points
    const p1 = startPoint;
    const p2 = [startPoint[0] - 1.2, startPoint[1] + 3];
    const p3 = [startPoint[0] - 2.4, startPoint[1]];
    const p4 = [startPoint[0] - 3.6, startPoint[1] + 3];
    const p5 = [startPoint[0] - 4.8, startPoint[1]];
    const p6 = [startPoint[0] - 6.0, startPoint[1] + 3];
    const p7 = [startPoint[0] - 7.2, startPoint[1]];
    const p8 = [startPoint[0] - 8.4, startPoint[1] + 3];
    const p9 = [-4, 0];

    const segment = Math.floor(progress * 8);
    // Add smoothing to the segment transition
    const t = smoothstep((progress * 8) % 1);

    // Add corner smoothing radius
    const cornerRadius = 0.3; // Adjust this value to control corner smoothness

    let x, y;
    if (segment === 0) {
      // Smooth the first corner
      x = p1[0] + (p2[0] - p1[0]) * t;
      y = p1[1] + (p2[1] - p1[1]) * smoothstep(t);
    } else if (segment === 1) {
      // Smooth transition at valley
      const smoothT = smoothstep(t);
      x = p2[0] + (p3[0] - p2[0]) * smoothT;
      y = p2[1] + (p3[1] - p2[1]) * (t * (2 - t)); // Softer descent
    } else if (segment === 2) {
      // Smooth ascent
      const smoothT = smoothstep(t);
      x = p3[0] + (p4[0] - p3[0]) * smoothT;
      y = p3[1] + (p4[1] - p3[1]) * (t * t); // Gentler rise
    } else if (segment === 3) {
      // Smooth descent to first M end
      const smoothT = smoothstep(t);
      x = p4[0] + (p5[0] - p4[0]) * smoothT;
      y = p4[1] + (p5[1] - p4[1]) * (t * (2 - t));
    } else if (segment === 4) {
      // Second M start, smooth ascent
      const smoothT = smoothstep(t);
      x = p5[0] + (p6[0] - p5[0]) * smoothT;
      y = p5[1] + (p6[1] - p5[1]) * (t * t);
    } else if (segment === 5) {
      // Smooth valley of second M
      const smoothT = smoothstep(t);
      x = p6[0] + (p7[0] - p6[0]) * smoothT;
      y = p6[1] + (p7[1] - p6[1]) * (t * (2 - t));
    } else if (segment === 6) {
      // Final ascent
      const smoothT = smoothstep(t);
      x = p7[0] + (p8[0] - p7[0]) * smoothT;
      y = p7[1] + (p8[1] - p7[1]) * (t * t);
    } else {
      // Final descent with smooth landing
      const smoothT = smoothstep(t);
      x = p8[0] + (p9[0] - p8[0]) * smoothT;
      y = p8[1] + (p9[1] - p8[1]) * (t * (2 - t));
    }

    // Add formation-based offset with smoother scaling
    const formationScale = 1 - Math.pow(progress, 4) * 0.3; // Smoother formation transition
    return [
      x + particle.formationOffset.x * formationScale,
      y + particle.formationOffset.y * formationScale
    ];
  };

  // Add time as a ref to use in render
  const timeRef = useRef(0);

  // Add a moving light reference
  const movingLightRef = useRef();

  // Add refs for the moving lights
  const followLightRef = useRef();
  const followLight2Ref = useRef();

  useFrame((state) => {
    if (particlesRef.current && !isAnimationComplete) {
      const color = new THREE.Color();
      const time = state.clock.elapsedTime;
      let allParticlesReachedEnd = true;
      
      // Calculate average position of active particles for light positioning
      let activeParticleCount = 0;
      let avgX = 0;
      let avgY = 0;
      
      particles.forEach((particle, i) => {
        if (particle.scale > 0) {
          activeParticleCount++;
          avgX += particle.position[0];
          avgY += particle.position[1];
        }
      });

      // Update follow light position
      if (followLightRef.current && activeParticleCount > 0) {
        avgX = avgX / activeParticleCount;
        avgY = avgY / activeParticleCount;
        followLightRef.current.position.set(avgX, avgY, 2);
        followLight2Ref.current.position.set(avgX + 1, avgY - 1, 2);
      }
      
      particles.forEach((particle, i) => {
        if (particle.individualPhase === 'entry') {
          if (time * 1000 > particle.delay) {
            particle.entryProgress = Math.min(1, 
              particle.entryProgress + 0.003 + 
              particle.entryProgress * (particle.acceleration * 0.3)
            );
            const progress = easeInOutCubic(particle.entryProgress);
            
            if (progress < 0.85) {
              allParticlesReachedEnd = false;
            }
            
            const [pathX, pathY] = calculateMPath(
              progress,
              entryPoint,
              writingPath[0],
              particle
            );
            
            particle.position[0] = pathX;
            particle.position[1] = pathY;
            particle.position[2] = entryPoint[2];

            if (progress >= 0.85) {
              particle.scale *= 0.9;
            }
          } else {
            allParticlesReachedEnd = false;
          }
        }

        // Update matrices and colors
        dummy.position.set(
          particle.position[0],
          particle.position[1],
          particle.position[2]
        );
        dummy.scale.setScalar(particle.scale);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(i, dummy.matrix);

        // Update colors for visible particles with more intense sparkle
        if (particle.scale > 0) {
          const sparkle = Math.sin(time * particle.sparkleSpeed + particle.sparklePhase) * 1.2; // Increased sparkle
          color.setStyle(particle.baseColor);
          color.multiplyScalar(3.5 + sparkle); // Increased brightness
          particlesRef.current.setColorAt(i, color);
        }
      });

      particlesRef.current.instanceMatrix.needsUpdate = true;
      particlesRef.current.instanceColor.needsUpdate = true;

      if (allParticlesReachedEnd && !isAnimationComplete) {
        setTimeout(() => {
          setIsAnimationComplete(true);
        }, 1000);
      }
    }
  });

  // Split text into single line
  const text = [
    "Merry Christmas from Consid",
  ];

  return (
    <>
      {/* Add moving point light */}
      <pointLight
        ref={movingLightRef}
        color="rgb(255, 220, 180)"
        intensity={2}
        distance={8}
        decay={2}
      />

      {/* Add following lights */}
      <pointLight
        ref={followLightRef}
        color="#ffffff"
        intensity={4}
        distance={4}
        decay={2}
      />
      <pointLight
        ref={followLight2Ref}
        color="#ffffff"
        intensity={3}
        distance={4}
        decay={2}
      />

      <instancedMesh ref={particlesRef} args={[null, null, particleCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshPhysicalMaterial
          vertexColors={true}
          metalness={0.98}
          roughness={0.01}
          envMapIntensity={8.0}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          emissive="#ffffff"
          emissiveIntensity={1.5}
          transparent
          reflectivity={1}
          specularIntensity={2.5}
        />
      </instancedMesh>
      
      {isAnimationComplete && (
        <Text3D text="Merry Christmas from Consid" />
      )}
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
      
      {/* Single hemisphere light */}
      <hemisphereLight
        skyColor="#ffffff"
        groundColor="#000000"
        intensity={0.3} // Increased from 0.15 to compensate for removed lights
      />

      {/* Rest of the scene */}
      <Snow />
      <GlitterText />
      <EffectComposer>
        <Bloom 
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur={true}
        />
      </EffectComposer>
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

const Text3D = memo(({ text }) => {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [sparklePositions, setSparklePositions] = useState([]);
  
  // Split text into letters with positions and calculate spacing
  const letters = useMemo(() => {
    const letterSpacing = 0.25;    // Increased base spacing further
    const wordSpacing = 0.6;       // Increased word spacing
    const xOffset = 0.5;
    let currentPosition = 0;
    
    // Calculate total width
    const totalWidth = text.split('').reduce((width, letter) => {
      return width + (letter === ' ' ? wordSpacing : letterSpacing);
    }, 0);
    
    // Start position to center the text
    currentPosition = -totalWidth / 2 + xOffset;
    
    return text.split('').map((letter, index, array) => {
      const position = [currentPosition, 0, 0];
      const nextLetter = array[index + 1];
      
      // Adjust spacing for specific letter combinations
      if (letter === 'M') {
        currentPosition += letterSpacing * 1.5;  // More space after M
      } else if (letter === 'C' && nextLetter === 'h') {
        currentPosition += letterSpacing * 1.4;  // More space between C and h
      } else if (letter === 'h' && nextLetter === 'r') {
        currentPosition += letterSpacing * 1.3;  // More space between h and r
      } else if (letter === 't' && nextLetter === 'm') {
        currentPosition += letterSpacing * 1.3;  // More space between t and m
      } else if (letter === 'm' && nextLetter === 'a') {
        currentPosition += letterSpacing * 1.3;  // More space between m and a
      } else if (letter === 'o' && nextLetter === 'm') {
        currentPosition += letterSpacing * 1.3;  // More space between o and m
      } else if (letter === 'C' && nextLetter === 'o') {
        currentPosition += letterSpacing * 1.3;  // More space between C and o
      } else if (letter === ' ') {
        currentPosition += wordSpacing;
      } else {
        currentPosition += letterSpacing;
      }
      
      return {
        char: letter,
        position: position
      };
    });
  }, [text]);

  // Update sparkle colors with more gold variations
  const sparkleColors = [
    {
      color: 'rgb(255, 255, 255)',
      emissive: 'rgb(255, 255, 255)',
      metalness: 0.9,
    }
  ];

  // Update createSparkles function
  const createSparkles = (letterIndex) => {
    const sparkleCount = 20;
    const letterPos = letters[letterIndex].position;
    const newSparkles = [];
    
    for (let i = 0; i < sparkleCount; i++) {
      const spread = 0.3;
      const colorScheme = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
      
      newSparkles.push({
        position: [
          letterPos[0] + (Math.random() - 0.5) * spread,
          letterPos[1] + (Math.random() - 0.5) * spread,
          letterPos[2]
        ],
        scale: 0.02 + Math.random() * 0.02,
        life: 1.0,
        speed: 0.02 + Math.random() * 0.02,
        color: colorScheme.color,
        emissive: colorScheme.emissive,
        metalness: colorScheme.metalness
      });
    }
    
    setSparklePositions(prev => [...prev, ...newSparkles]);
  };

  // Update continuous sparkle generation in useFrame
  useFrame((state, delta) => {
    // Update existing sparkles
    setSparklePositions(prev => 
      prev.map(sparkle => ({
        ...sparkle,
        life: sparkle.life - sparkle.speed,
        scale: sparkle.scale * 0.95
      })).filter(sparkle => sparkle.life > 0)
    );

    // Add new sparkles to visible letters
    for (let i = 0; i < visibleLetters; i++) {
      if (Math.random() > 0.8) {
        const letterPos = letters[i].position;
        const spread = 0.2;
        const colorScheme = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
        
        setSparklePositions(prev => [...prev, {
          position: [
            letterPos[0] + (Math.random() - 0.5) * spread,
            letterPos[1] + (Math.random() - 0.5) * spread,
            letterPos[2],
          ],
          scale: 0.01 + Math.random() * 0.01,
          life: 0.5 + Math.random() * 0.5,
          speed: 0.03 + Math.random() * 0.02,
          color: colorScheme.color,
          emissive: colorScheme.emissive,
          metalness: colorScheme.metalness
        }]);
      }
    }
  });

  useEffect(() => {
    setVisibleLetters(0);
    setSparklePositions([]);
    
    const interval = setInterval(() => {
      setVisibleLetters(prev => {
        if (prev < letters.length) {
          createSparkles(prev);
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [letters.length]);

  return (
    <group>
      {/* Render sparkles */}
      {sparklePositions.map((sparkle, index) => (
        <mesh
          key={`sparkle-${index}`}
          position={sparkle.position}
          scale={sparkle.scale}
        >
          <sphereGeometry args={[1, 4, 4]} />
          <meshPhysicalMaterial
            color={sparkle.color}
            metalness={sparkle.metalness}
            roughness={0.05}
            envMapIntensity={3.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            emissive={sparkle.emissive}
            emissiveIntensity={0.8 + (1 - sparkle.life) * 3}
            transparent
            opacity={sparkle.life}
          />
        </mesh>
      ))}

      {/* Render letters */}
      {letters.map((letter, index) => (
        <Text
          key={index}
          position={letter.position}
          visible={index < visibleLetters}
          fontSize={0.4}
          anchorX="center"
          anchorY="middle"
          font="/fonts/PlusJakartaSans-Bold.ttf"
        >
          {letter.char}
          <meshPhysicalMaterial
            color="rgb(255, 255, 255)"
            metalness={0.9}
            roughness={0.05}
            envMapIntensity={3.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            emissive="rgb(255, 255, 255)"
            emissiveIntensity={0.8}
          />
        </Text>
      ))}
    </group>
  );
});
