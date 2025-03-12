'use client';

import * as THREE from 'three';
import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { type Mesh, type Color, TextureLoader, type BufferGeometry } from 'three';

// 型定義
type TrailPoint = {
  position: [number, number, number];
  timestamp: number;
  opacity: number;
};

type OrbitType = 'lagrange' | 'earth' | 'moon' | 'none';
type OrbitCategory = 'lagrange' | 'earth' | 'moon';
type SatelliteProps = {
  orbitType: OrbitType;
  specificOrbit: string;
  simulationSpeed: number;
  size: number;
  paused: boolean;
  showTrail: boolean;
};

// 共通の時間係数を定義
const BASE_ORBITAL_SPEED = 0.0001; // 基本となる軌道速度係数

// 地球モデルにアニメーション機能を追加
function Earth({ simulationSpeed = 1 }) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, '/assets/textures/earth/2k_earth_daymap.jpg');

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001 * simulationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial 
        map={texture}
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

// 月の軌道を表示するコンポーネント
function MoonOrbit() {
  const points = [];
  const segments = 64;
  
  // 月の軌道を円形で表現
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        10 * Math.cos(angle),
        0,
        10 * Math.sin(angle)
      )
    );
  }

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line>
      <bufferGeometry {...lineGeometry} />
      <lineBasicMaterial color="#FFD700" opacity={0.9} transparent={true} />
    </line>
  );
}

// 月モデルに速度制御を追加
function Moon({ simulationSpeed = 1 }) {
  const meshRef = useRef<Mesh>(null);
  const [position, setPosition] = useState<[number, number, number]>([10, 0, 0]);
  const texture = useLoader(TextureLoader, '/assets/textures/moon/2k_moon.jpg');
  
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const angle = currentTime * BASE_ORBITAL_SPEED * simulationSpeed;
      setPosition([
        10 * Math.cos(angle),
        0,
        10 * Math.sin(angle),
      ]);
    }, 16);
    
    return () => clearInterval(interval);
  }, [simulationSpeed]);

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <sphereGeometry args={[1, 64, 64]} /> {/* 解像度を上げて滑らかに */}
      <meshStandardMaterial 
        map={texture}
        metalness={0.1}
        roughness={0.8} 
      />
    </mesh>
  );
}

// 衛星の軌道計算の戻り値の型を明示的に定義
function calculateNewPosition(
  type: OrbitType, 
  orbit: string, 
  currentTime: number,
  simulationSpeed: number,
): [number, number, number] {
  const angle = currentTime * BASE_ORBITAL_SPEED * simulationSpeed;
  const moonAngle = angle; // 月の角度と同じタイミングで計算

  // 月の現在位置を計算（月軌道系の衛星位置計算に使用）
  const moonX = 10 * Math.cos(moonAngle);
  const moonZ = 10 * Math.sin(moonAngle);

  switch(type) {
    case "lagrange":
      switch(orbit) {
        case "l1":
          // L1点（地球-月の間）- 月の位置に基づいて計算
          return [
            moonX * 0.5, // 地球と月の間の0.5の位置
            0,
            moonZ * 0.5,
          ];
        case "l2":
          // L2点（月の向こう側）- 月の位置に基づいて計算
          return [
            moonX * 1.2, // 月の位置から20%外側
            0,
            moonZ * 1.2,
          ];
        case "l3":
          // L3点（地球の反対側）
          return [
            -10 * Math.cos(moonAngle),
            0,
            -10 * Math.sin(moonAngle),
          ];
        case "l4":
          // L4点（月の60度前方）
          const l4Angle = moonAngle + Math.PI/3;
          return [
            10 * Math.cos(l4Angle),
            0,
            10 * Math.sin(l4Angle),
          ];
        case "l5":
          // L5点（月の60度後方）
          const l5Angle = moonAngle - Math.PI/3;
          return [
            10 * Math.cos(l5Angle),
            0,
            10 * Math.sin(l5Angle),
          ];
        case "l1_halo":
          // L1ハロー軌道 - 月の位置に基づいて計算
          const l1Center = [moonX * 0.5, 0, moonZ * 0.5];
          return [
            l1Center[0] + Math.sin(angle * 2) * 0.5,
            Math.sin(angle * 3) * 0.8,
            l1Center[2] + Math.cos(angle * 2) * 0.5,
          ];
        case "l2_halo":
          // L2ハロー軌道 - 月の位置に基づいて計算
          const l2Center = [moonX * 1.2, 0, moonZ * 1.2];
          return [
            l2Center[0] + Math.sin(angle * 2) * 0.5,
            Math.sin(angle * 3) * 0.8,
            l2Center[2] + Math.cos(angle * 2) * 0.5,
          ];
        case "l3_halo":
          // L3ハロー軌道 - 地球の反対側を基準に周回
          const l3Center = [-10 * Math.cos(moonAngle), 0, -10 * Math.sin(moonAngle)];
          const l3FastAngle = angle * 3; // より速い周期で回転
          return [
            l3Center[0] + Math.sin(l3FastAngle) * 1.5,
            Math.sin(l3FastAngle * 1.2) * 1.0,
            l3Center[2] + Math.cos(l3FastAngle) * 1.5,
          ];
        case "l4_lissajous":
          // L4リサージュ軌道 - L4点を中心としたリサージュパターン
          const l4Center = [
            10 * Math.cos(moonAngle + Math.PI/3),
            0,
            10 * Math.sin(moonAngle + Math.PI/3)
          ];
          const l4FastAngle = angle * 2; // より速い周期で回転
          return [
            l4Center[0] + Math.sin(l4FastAngle * 0.7) * 1.2,
            Math.sin(l4FastAngle * 1.1) * 0.8,
            l4Center[2] + Math.sin(l4FastAngle * 0.9) * 1.2, // 異なる周期で変動
          ];
        case "l5_lissajous":
          // L5リサージュ軌道 - L5点を中心としたリサージュパターン
          const l5Center = [
            10 * Math.cos(moonAngle - Math.PI/3),
            0,
            10 * Math.sin(moonAngle - Math.PI/3)
          ];
          const l5FastAngle = angle * 2; // より速い周期で回転
          return [
            l5Center[0] + Math.sin(l5FastAngle * 0.8) * 1.2,
            Math.sin(l5FastAngle * 1.2) * 0.8,
            l5Center[2] + Math.sin(l5FastAngle * 1.0) * 1.2, // 異なる周期で変動
          ];
        default:
          return [5, 0, 0];
      }
    
    case "earth":
      switch(orbit) {
        case "geo":
          // 静止衛星軌道 (GEO) - 地球自転と同期
          return [
            4 * Math.cos(angle * 0.1),
            0,
            4 * Math.sin(angle * 0.1),
          ];
        case "gso_equator":
          // 対地同期軌道 (GSO赤道) - わずかな傾きを持つ
          return [
            4 * Math.cos(angle * 0.1),
            Math.sin(angle * 0.05) * 0.2,
            4 * Math.sin(angle * 0.1),
          ];
        // ...他の地球軌道も同様に修正...
        default:
          return [4, 0, 0];
      }
      
    case "moon":
      // 月軌道系の場合、常に現在の月の位置を基準に計算
      switch(orbit) {
        case "llo_circular":
          // 月低軌道 (LLO円形) - 月の周りを一定距離で周回
          const lloAngle = angle * 5; // 月の周りをより速く周回
          return [
            moonX + Math.cos(lloAngle) * 1.5,
            0,
            moonZ + Math.sin(lloAngle) * 1.5,
          ];
        case "llo_elliptical":
          // 月低軌道 (LLO楕円形) - 月の周りを楕円軌道で周回
          const moonEccentricity = 0.3;
          const moonSemiMajorAxis = 1.8;
          const moonOrbitAngle = angle * 5;
          const moonRadius = moonSemiMajorAxis * (1 - moonEccentricity * Math.cos(moonOrbitAngle));
          return [
            moonX + moonRadius * Math.cos(moonOrbitAngle),
            0,
            moonZ + moonRadius * Math.sin(moonOrbitAngle),
          ];
        case "llo_polar":
          // 月低軌道 (LLO極周回) - 月の極を周回
          const polarAngle = angle * 5;
          return [
            moonX + Math.cos(polarAngle) * 1.5,
            Math.sin(polarAngle) * 1.5,
            moonZ,
          ];
        case "frozen":
          // 月フローズン軌道 - 月との相対位置を保持
          return [
            moonX + Math.cos(angle) * 2,
            Math.sin(angle * 0.5) * 0.5,
            moonZ + Math.sin(angle) * 2,
          ];
        case "transfer":
          // 月-地球転移軌道
          const transferPhase = (Math.sin(angle * 0.05) + 1) / 2;
          return [
            moonX * transferPhase,
            Math.sin(angle * 0.2) * (1 - transferPhase) * 2,
            moonZ * transferPhase,
          ];
        case "distant":
          // 遠月点軌道 - 月からの距離を変動させる
          return [
            moonX + Math.cos(angle * 0.3) * 3,
            Math.sin(angle * 0.3) * 2,
            moonZ + Math.sin(angle * 0.3) * 3,
          ];
        default:
          return [moonX + 1.5, 0, moonZ];
      }
    
    default:
      return [5, 0, 0];
  }
}

// 衛星モデルに各種コントロールを追加
function Satellite({ 
  orbitType,
  specificOrbit,
  simulationSpeed,
  size,
  paused,
  showTrail
}: SatelliteProps) {
  const meshRef = useRef<Mesh>(null);
  const trailRef = useRef<Mesh>(null);
  const [position, setPosition] = useState<[number, number, number]>([5, 0, 0]);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const orbitPeriodRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const prevOrbitRef = useRef<{ type: OrbitType; specific: string; speed: number }>({ 
    type: orbitType, 
    specific: specificOrbit,
    speed: simulationSpeed
  });

  // 軌道やシミュレーション速度が変更された時に軌跡をリセット
  useEffect(() => {
    if (prevOrbitRef.current.type !== orbitType || 
        prevOrbitRef.current.specific !== specificOrbit ||
        prevOrbitRef.current.speed !== simulationSpeed) {
      setTrail([]);
      prevOrbitRef.current = { 
        type: orbitType, 
        specific: specificOrbit,
        speed: simulationSpeed 
      };
    }
  }, [orbitType, specificOrbit, simulationSpeed]);

  // 軌道周期を計算する関数
  const calculateOrbitPeriod = (type: OrbitType, orbit: string): number => {
    // 軌道タイプに基づいて周期を設定（秒単位）
    switch(type) {
      case "lagrange":
        return 60; // ラグランジュ点軌道は60秒で1周
      case "earth":
        switch(orbit) {
          case "geo":
          case "gso_equator":
          case "gso_mid":
            return 40; // 地球同期軌道は40秒で1周
          case "qzo_8":
          case "qzo_asym":
            return 30; // 準天頂軌道は30秒で1周
          case "molniya":
            return 50; // モルニヤ軌道は50秒で1周
          default:
            return 40;
        }
      case "moon":
        switch(orbit) {
          case "llo_circular":
          case "llo_elliptical":
          case "llo_polar":
            return 20; // 月低軌道は20秒で1周
          case "frozen":
            return 30; // フローズン軌道は30秒で1周
          case "transfer":
            return 100; // 転移軌道は100秒で1周
          case "distant":
            return 40; // 遠月点軌道は40秒で1周
          default:
            return 30;
        }
      default:
        return 40;
    }
  };

  // 軌道計算の更新
  useEffect(() => {
    if (paused) return;

    // 新しい軌道が始まるたびに周期を更新
    orbitPeriodRef.current = calculateOrbitPeriod(orbitType, specificOrbit);
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const newPosition = calculateNewPosition(
        orbitType,
        specificOrbit,
        currentTime,
        simulationSpeed
      );
      
      setPosition(newPosition);
      
      if (showTrail) {
        setTrail(prev => {
          const newPoint: TrailPoint = {
            position: newPosition,
            timestamp: currentTime,
            opacity: 1.0
          };
          
          const updatedTrail = prev.map(point => ({
            ...point,
            opacity: Math.max(0, 1.0 - ((currentTime - point.timestamp) / 1000 - orbitPeriodRef.current) / orbitPeriodRef.current)
          }));
          
          const filteredTrail = updatedTrail.filter(point => 
            (currentTime - point.timestamp) / 1000 <= orbitPeriodRef.current * 2
          );
          
          return [...filteredTrail, newPoint];
        });
      } else {
        setTrail([]);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [orbitType, specificOrbit, simulationSpeed, paused, showTrail]);

  // 衛星の色を軌道タイプに基づいて変更
  let satelliteColor = "#FFFFFF";
  let emissiveColor = "#AAAAAA";
  
  switch(orbitType) {
    case "lagrange":
      satelliteColor = "#9C27B0";
      emissiveColor = "#6A1B9A";
      break;
    case "earth":
      satelliteColor = "#2196F3";
      emissiveColor = "#1565C0";
      break;
    case "moon":
      satelliteColor = "#4CAF50";
      emissiveColor = "#2E7D32";
      break;
    default:
      satelliteColor = "#FFFFFF";
      emissiveColor = "#AAAAAA";
  }

  // サイズの調整（デフォルトの20倍を基準とする）
  const scale = size / 20;

  // エフェクト用のジオメトリを生成する関数
  const generateTrailGeometry = (
    points: [number, number, number][], 
    colors: Color[], 
    lineWidths: number[]
  ): BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 6); // 2頂点/ポイント x 3座標
    const vertexColors = new Float32Array(points.length * 6); // 2頂点/ポイント x RGB

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const direction = new THREE.Vector3(
        next[0] - current[0],
        next[1] - current[1],
        next[2] - current[2]
      ).normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      const width = lineWidths[i] * 0.1; // 基本の太さを調整

      // 各ポイントに2つの頂点を生成（線の両端）
      positions[i * 6] = current[0] + perpendicular.x * width;
      positions[i * 6 + 1] = current[1];
      positions[i * 6 + 2] = current[2] + perpendicular.z * width;
      positions[i * 6 + 3] = current[0] - perpendicular.x * width;
      positions[i * 6 + 4] = current[1];
      positions[i * 6 + 5] = current[2] - perpendicular.z * width;

      // 頂点カラーを設定
      vertexColors[i * 6] = colors[i].r;
      vertexColors[i * 6 + 1] = colors[i].g;
      vertexColors[i * 6 + 2] = colors[i].b;
      vertexColors[i * 6 + 3] = colors[i].r;
      vertexColors[i * 6 + 4] = colors[i].g;
      vertexColors[i * 6 + 5] = colors[i].b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));

    // インデックスを生成してトライアングルストリップを作成
    const indices = [];
    for (let i = 0; i < points.length - 1; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 2, base + 1, base + 3);
    }
    geometry.setIndex(indices);

    return geometry;
  };

  useFrame(() => {
    if (trailRef.current && trail.length > 1) {
      const positions: [number, number, number][] = [];
      const colors: THREE.Color[] = [];
      const lineWidths: number[] = [];
      const color = new THREE.Color(satelliteColor);

      trail.forEach((point) => {
        positions.push(point.position);
        const pointColor = color.clone();
        pointColor.multiplyScalar(point.opacity);
        colors.push(pointColor);
        lineWidths.push(point.opacity);
      });

      if (trailRef.current) {
        const geometry = generateTrailGeometry(positions, colors, lineWidths);
        trailRef.current.geometry = geometry;
        geometry.computeBoundingSphere();
      }
    }
  });

  return (
    <>
      <group position={position as [number, number, number]}>
        {/* 衛星本体 - スケール調整可能に */}
        <mesh ref={meshRef} scale={[scale, scale, scale]}>
          <boxGeometry args={[0.5, 0.2, 0.2]} />
          <meshStandardMaterial 
            color="#E0E0E0" 
            metalness={0.9} 
            roughness={0.1}
            envMapIntensity={1}
            transparent={false}
            depthWrite={true}
          />
        </mesh>
        
        {/* 太陽電池パネル */}
        <mesh 
          position={[0, 0, 0.5 * scale]} 
          rotation={[0, 0, Math.PI / 2]} 
          scale={[scale, scale, scale]}
        >
          <boxGeometry args={[0.8, 0.05, 0.4]} />
          <meshStandardMaterial 
            color="#FFD700" 
            metalness={0.8} 
            roughness={0.2}
            emissive={emissiveColor}
            emissiveIntensity={0.3}
            transparent={false}
            depthWrite={true}
          />
        </mesh>
        
        <mesh 
          position={[0, 0, -0.5 * scale]} 
          rotation={[0, 0, Math.PI / 2]} 
          scale={[scale, scale, scale]}
        >
          <boxGeometry args={[0.8, 0.05, 0.4]} />
          <meshStandardMaterial 
            color="#FFD700" 
            metalness={0.8} 
            roughness={0.2}
            emissive={emissiveColor}
            emissiveIntensity={0.3}
            transparent={false}
            depthWrite={true}
          />
        </mesh>
      </group>

      {/* 軌跡の表示 */}
      {showTrail && trail.length > 1 && (
        <mesh ref={trailRef}>
          <bufferGeometry />
          <meshBasicMaterial 
            vertexColors 
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </>
  );
}

const OrbitSimulation = () => {
  const [orbitType, setOrbitType] = useState<OrbitType>('lagrange');
  const [specificOrbit, setSpecificOrbit] = useState('l1');
  const [simulationSpeed, setSimulationSpeed] = useState([1]);
  const [satelliteSize, setSatelliteSize] = useState([20]);
  const [showTrail, setShowTrail] = useState(true);
  const [activeTab, setActiveTab] = useState<OrbitType>("lagrange");
  const [isPaused, setIsPaused] = useState(false);

  const handleTabChange = (value: string) => {
    const orbitType = value as OrbitCategory;
    setActiveTab(orbitType);
    setOrbitType(orbitType);
    // タブ変更時に、そのカテゴリの最初の軌道を選択する
    if (orbitOptions[orbitType] && orbitOptions[orbitType][0]) {
      setSpecificOrbit(orbitOptions[orbitType][0].id);
    }
  };

  // 特定の軌道を選択するハンドラー
  const handleOrbitSelect = (orbitId: string) => {
    setSpecificOrbit(orbitId);
  };

  // シミュレーションのリセット
  const handleReset = () => {
    setSimulationSpeed([1]);
    setSatelliteSize([20]);
    setShowTrail(true);
    setIsPaused(false);
    // 軌道の軌跡をリセット
    const currentOrbitType = orbitType;
    const currentSpecificOrbit = specificOrbit;
    setOrbitType('none' as OrbitType);
    // わずかな遅延後に元の軌道を復元
    requestAnimationFrame(() => {
      setOrbitType(currentOrbitType);
      setSpecificOrbit(currentSpecificOrbit);
    });
  };

  // 再生/一時停止の切り替え
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // シミュレーション速度の変更ハンドラー
  const handleSpeedChange = (newSpeed: number[]) => {
    setSimulationSpeed(newSpeed);
  };

  // 軌道タイプごとのオプション
  const orbitOptions = {
    lagrange: [
      { id: "l1", name: "L1点" },
      { id: "l2", name: "L2点" },
      { id: "l3", name: "L3点" },
      { id: "l4", name: "L4点" },
      { id: "l5", name: "L5点" },
      { id: "l1_halo", name: "L1ハロー軌道" },
      { id: "l2_halo", name: "L2ハロー軌道" },
      { id: "l3_halo", name: "L3ハロー軌道" },
      { id: "l4_lissajous", name: "L4リサージュ軌道" },
      { id: "l5_lissajous", name: "L5リサージュ軌道" },
    ],
    earth: [
      { id: "geo", name: "静止衛星軌道 (GEO)" },
      { id: "gso_equator", name: "対地同期軌道 (GSO赤道)" },
      { id: "gso_mid", name: "対地同期軌道 (GSO中緯度)" },
      { id: "qzo_8", name: "準天頂軌道 (QZO 8の字)" },
      { id: "qzo_asym", name: "準天頂軌道 (QZO非対称)" },
      { id: "molniya", name: "モルニヤ軌道" },
    ],
    moon: [
      { id: "llo_circular", name: "月低軌道 (LLO円形)" },
      { id: "llo_elliptical", name: "月低軌道 (LLO楕円形)" },
      { id: "llo_polar", name: "月低軌道 (LLO極周回)" },
      { id: "frozen", name: "月フローズン軌道" },
      { id: "transfer", name: "月-地球転移軌道" },
      { id: "distant", name: "遠月点軌道" },
    ]
  };

  return (
    <div className="flex h-screen">
      {/* Three.jsシミュレーション領域 - 画面の左側80% */}
      <div className="w-[80%] h-full bg-black">
        <Canvas 
          camera={{ position: [0, 5, 15], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            logarithmicDepthBuffer: true,
          }}
        >
          {/* 環境光 - 全体を少し明るく */}
          <ambientLight intensity={0.3} />
          
          {/* 太陽を想定した強い指向性ライト */}
          <directionalLight 
            position={[15, 10, 5]} 
            intensity={2}
          />
          
          {/* 反対側からの弱い補助ライト - 完全な暗部を防ぐ */}
          <pointLight position={[-10, -10, -10]} intensity={0.2} color="#6B778D" />
          
          {/* HDRIのような効果のための環境ライト */}
          <hemisphereLight 
            color="#FFFFFF"
            groundColor="#000000"
            intensity={0.2} 
          />
          
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.6} fade />
          <MoonOrbit /> {/* 月の軌道を追加 */}
          <Earth simulationSpeed={simulationSpeed[0]} />
          <Moon simulationSpeed={simulationSpeed[0]} />
          {orbitType !== 'none' && (
            <Satellite 
              orbitType={orbitType} 
              specificOrbit={specificOrbit}
              simulationSpeed={simulationSpeed[0]}
              size={satelliteSize[0]}
              paused={isPaused}
              showTrail={showTrail}
            />
          )}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
        </Canvas>
      </div>

      {/* 操作パネル - 画面の右側20% */}
      <Card className="w-[25%] h-full overflow-y-auto rounded-none border-l">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold mb-4">軌道シミュレーション</h2>
          <Tabs defaultValue="orbit" className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="orbit">軌道選択</TabsTrigger>
              <TabsTrigger value="control">コントロール</TabsTrigger>
            </TabsList>
            
            {/* 軌道選択タブ */}
            <TabsContent value="orbit" className="space-y-4">
              <div className="space-y-4">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="lagrange">ラグランジュ点</TabsTrigger>
                    <TabsTrigger value="earth">地球同期</TabsTrigger>
                    <TabsTrigger value="moon">月軌道</TabsTrigger>
                  </TabsList>
                  
                  {/* 各軌道カテゴリのコンテンツ */}
                  {(["lagrange", "earth", "moon"] as OrbitCategory[]).map((category) => (
                    <TabsContent key={category} value={category} className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        {orbitOptions[category].map((option: { id: string; name: string }) => (
                          <Button 
                            key={option.id} 
                            variant={specificOrbit === option.id ? "default" : "outline"}
                            onClick={() => handleOrbitSelect(option.id)}
                            className="h-14 text-sm justify-start"
                          >
                            {option.name}
                          </Button>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </TabsContent>
            
            {/* コントロールタブ */}
            <TabsContent value="control" className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">シミュレーション速度</label>
                    <span className="text-sm font-mono">{simulationSpeed[0].toFixed(1)}x</span>
                  </div>
                  <Slider
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={simulationSpeed}
                    onValueChange={handleSpeedChange}
                    disabled={isPaused}
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">衛星サイズ</label>
                    <span className="text-sm font-mono">{satelliteSize[0]}倍</span>
                  </div>
                  <Slider
                    min={10}
                    max={50}
                    step={5}
                    value={satelliteSize}
                    onValueChange={setSatelliteSize}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">軌跡表示</label>
                  <Switch
                    checked={showTrail}
                    onCheckedChange={setShowTrail}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={togglePause}
                    variant={isPaused ? "outline" : "default"}
                  >
                    {isPaused ? "再開" : "一時停止"}
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={handleReset}
                    variant="secondary"
                  >
                    リセット
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrbitSimulation;