"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { RobotState } from "./ai-robot";

type RobotSceneProps = {
  active: boolean;
  onUnsupported: () => void;
  state: RobotState;
};

function drawMouthCanvas(
  ctx: CanvasRenderingContext2D,
  state: RobotState,
  elapsed: number,
  reducedMotion: boolean,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  if (state === "talking") {
    // Dynamic talking mouth: smooth multi-harmonic opening and articulation
    const t = elapsed * 13;
    const rawOpen =
      Math.sin(t) * 0.48 +
      Math.sin(t * 0.6) * 0.32 +
      Math.cos(t * 1.9) * 0.22;
    const openness = reducedMotion
      ? 0.5
      : Math.max(0.08, Math.min(1, (rawOpen + 0.42) * 0.85));
    const widthMod = reducedMotion ? 1 : 0.88 + Math.sin(t * 0.45) * 0.14;

    const rx = 44 * widthMod;
    const ry = 4 + openness * 22;

    // Glowing outer halo
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner glowing resonance aperture
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    grad.addColorStop(0, "rgba(224, 242, 254, 0.96)");
    grad.addColorStop(0.35, "rgba(56, 189, 248, 0.8)");
    grad.addColorStop(0.8, "rgba(14, 116, 144, 0.42)");
    grad.addColorStop(1, "rgba(14, 116, 144, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cybernetic audio waveform / speech equalizer bars inside mouth aperture
    if (openness > 0.28) {
      const barCount = 5;
      const barSpacing = (rx * 1.1) / (barCount - 1);
      const startX = cx - (rx * 1.1) / 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      for (let i = 0; i < barCount; i++) {
        const barX = startX + i * barSpacing;
        const barH = ry * (0.35 + Math.sin(t * 1.4 + i * 1.3) * 0.48);
        ctx.fillRect(barX - 1.5, cy - barH / 2, 3, Math.max(2, barH));
      }
    }

    // Outer lip neon stroke
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 3.2;
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (state === "thinking") {
    // Futuristic cybernetic loading wave / thinking pulse
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.beginPath();
    const len = 64;
    const startX = cx - len / 2;
    for (let x = 0; x <= len; x += 2) {
      const wave = Math.sin((x / len) * Math.PI * 4 - elapsed * 7.5) * 5.5;
      if (x === 0) ctx.moveTo(startX + x, cy + wave);
      else ctx.lineTo(startX + x, cy + wave);
    }
    ctx.stroke();

    // Orbiting data pulse
    const pulseX = cx + Math.sin(elapsed * 4.5) * 28;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pulseX, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // Idle / Listening: gentle, friendly cybernetic glowing smile arc
    ctx.save();
    ctx.shadowColor = state === "listening" ? "#60a5fa" : "#38bdf8";
    ctx.shadowBlur = state === "listening" ? 16 : 10;
    ctx.strokeStyle = state === "listening" ? "#93c5fd" : "#38bdf8";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";

    const width = 56;
    const smileDepth = state === "listening" ? 8.5 : 6;

    // Glowing smile curve
    ctx.beginPath();
    ctx.moveTo(cx - width / 2, cy - 2);
    ctx.quadraticCurveTo(cx, cy + smileDepth, cx + width / 2, cy - 2);
    ctx.stroke();

    // Inner bright core
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
}

function RobotModel({
  active,
  onUnsupported,
  state: motionState,
}: RobotSceneProps) {
  const { scene, animations } = useGLTF("/models/aether.glb");
  const model = useMemo(() => {
    const instance = clone(scene);
    instance.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const instanceMaterials = sourceMaterials.map((material) => material.clone());
      object.material = Array.isArray(object.material)
        ? instanceMaterials
        : instanceMaterials[0];
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    });
    return instance;
  }, [scene]);
  const robotRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const { camera, size } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const fittedBoundsRef = useRef<THREE.Box3 | null>(null);
  const modelFittedRef = useRef(false);
  const headRef = useRef<THREE.Object3D | null>(null);
  const headBaseRotationRef = useRef<THREE.Euler | null>(null);
  const emissiveMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const mouthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouthContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const mouthTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const mouthMeshRef = useRef<THREE.Mesh | null>(null);
  const particleGeometry = useMemo(() => {
    const positions = new Float32Array(38 * 3);
    for (let index = 0; index < 38; index += 1) {
      const angle = index * 2.399963229728653;
      const variation = (index * 17) % 19;
      const radius = 1.08 + (variation / 19) * 0.38;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] =
        1.88 + Math.sin(angle) * (1.55 + (variation / 19) * 0.18);
      positions[index * 3 + 2] = -0.35 + (variation / 19) * 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { actions } = useAnimations(animations, model);
  const walkAction = animations[0] ? actions[animations[0].name] : undefined;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);
    return () => mediaQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const head = model.getObjectByName("Head_021") ?? null;
    headRef.current = head;
    headBaseRotationRef.current = head?.rotation.clone() ?? null;

    // Attach dynamic cybernetic mouth mesh directly to head bone
    if (head) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      mouthCanvasRef.current = canvas;
      mouthContextRef.current = ctx;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      mouthTextureRef.current = texture;

      const planeGeo = new THREE.PlaneGeometry(13.5, 6.8);
      const planeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(planeGeo, planeMat);
      // Place on front faceplate of robot head
      mesh.position.set(0, 14.1, 26.85);
      mesh.rotation.x = THREE.MathUtils.degToRad(-8);
      mesh.renderOrder = 999;

      head.add(mesh);
      mouthMeshRef.current = mesh;
    }

    const materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        material.color.set(0x91bdff);
        material.emissive.set(0x174b82);
        material.emissiveIntensity = 0.3;
        materials.push(material);
      });
    });
    emissiveMaterialsRef.current = materials;
    return () => {
      if (head && mouthMeshRef.current) {
        head.remove(mouthMeshRef.current);
        mouthMeshRef.current.geometry.dispose();
        if (Array.isArray(mouthMeshRef.current.material)) {
          mouthMeshRef.current.material.forEach((m) => m.dispose());
        } else {
          mouthMeshRef.current.material.dispose();
        }
      }
      mouthTextureRef.current?.dispose();
      mouthTextureRef.current = null;
      mouthCanvasRef.current = null;
      mouthContextRef.current = null;
      mouthMeshRef.current = null;

      materials.forEach((material) => material.dispose());
      emissiveMaterialsRef.current = [];
    };
  }, [model]);

  useEffect(() => {
    const action = walkAction ?? null;
    walkActionRef.current = action;
    if (!action || reducedMotion) return;
    if (active) {
      action.reset().fadeIn(0.3).play();
    } else {
      action.fadeOut(0.25);
    }
    return () => {
      action.fadeOut(0.15);
      walkActionRef.current = null;
    };
  }, [active, reducedMotion, walkAction]);

  useLayoutEffect(() => {
    cameraRef.current =
      camera instanceof THREE.PerspectiveCamera ? camera : null;
  }, [camera]);

  useEffect(
    () => () => particleGeometry.dispose(),
    [particleGeometry],
  );

  useLayoutEffect(() => {
    if (modelFittedRef.current) return;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const dimensions = bounds.getSize(new THREE.Vector3());
    if (
      ![dimensions.x, dimensions.y, dimensions.z].every(Number.isFinite) ||
      dimensions.y <= 0
    ) {
      console.error("The Aether robot model has invalid dimensions.");
      onUnsupported();
      return;
    }

    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 4.5 / dimensions.y;
    model.scale.setScalar(scale);
    model.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    );
    model.updateMatrixWorld(true);
    fittedBoundsRef.current = new THREE.Box3().setFromObject(model, true);
    modelFittedRef.current = true;
  }, [model, onUnsupported]);

  useLayoutEffect(() => {
    const perspectiveCamera = cameraRef.current;
    const bounds = fittedBoundsRef.current;
    if (!perspectiveCamera || !bounds || !size.width || !size.height) return;
    const modelCenter = bounds.getCenter(new THREE.Vector3());
    const modelSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov =
      2 * Math.atan(Math.tan(verticalFov / 2) * (size.width / size.height));
    const distance =
      Math.max(
        modelSphere.radius / Math.tan(verticalFov / 2),
        modelSphere.radius / Math.tan(horizontalFov / 2),
      ) * 1.12;

    perspectiveCamera.position.set(
      modelCenter.x,
      modelCenter.y,
      modelCenter.z + distance,
    );
    perspectiveCamera.lookAt(modelCenter);
    perspectiveCamera.near = Math.max(0.1, distance - modelSphere.radius * 2);
    perspectiveCamera.far = distance + modelSphere.radius * 2;
    perspectiveCamera.updateProjectionMatrix();
  }, [size.height, size.width]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;
    const robot = robotRef.current;
    const speaking = motionState === "talking";

    // Update dynamic cybernetic mouth animation on canvas
    if (mouthContextRef.current && mouthTextureRef.current) {
      drawMouthCanvas(
        mouthContextRef.current,
        motionState,
        elapsed,
        reducedMotion,
      );
      mouthTextureRef.current.needsUpdate = true;
    }

    if (robot && !reducedMotion) {
      robot.rotation.y = THREE.MathUtils.damp(
        robot.rotation.y,
        active ? 0.12 : 0.04,
        2.2,
        delta,
      );
      robot.rotation.z = THREE.MathUtils.damp(
        robot.rotation.z,
        motionState === "listening" ? -0.035 : 0,
        2.2,
        delta,
      );
      robot.position.y =
        Math.sin(elapsed * (speaking ? 3.4 : 1.3)) *
        (speaking ? 0.038 : 0.02) *
        (active ? 1 : 0.35);

      if (walkActionRef.current) {
        walkActionRef.current.timeScale =
          motionState === "talking" ? 1.18 : motionState === "listening" ? 0.72 : 1;
      }
      const head = headRef.current;
      const baseRotation = headBaseRotationRef.current;
      if (head && baseRotation) {
        const speechNod =
          Math.sin(elapsed * 6.8) * 0.036 + Math.sin(elapsed * 3.2) * 0.022;
        const speechYaw = Math.sin(elapsed * 2.6) * 0.028;
        const speechTilt = Math.sin(elapsed * 4.2) * 0.018;

        head.rotation.x =
          baseRotation.x +
          (motionState === "listening"
            ? 0.08
            : speaking
              ? speechNod
              : Math.sin(elapsed * 1.3) * 0.012);
        head.rotation.y = baseRotation.y + (speaking ? speechYaw : 0);
        head.rotation.z =
          baseRotation.z +
          (motionState === "listening"
            ? 0.045
            : speaking
              ? speechTilt
              : 0);
      }
    }

    const targetIntensity = motionState === "talking" ? 0.85 : 0.3;
    emissiveMaterialsRef.current.forEach((material) => {
      material.emissiveIntensity = reducedMotion
        ? targetIntensity
        : THREE.MathUtils.damp(
            material.emissiveIntensity,
            motionState === "talking"
              ? targetIntensity + Math.sin(elapsed * 9) * 0.16
              : targetIntensity,
            3,
            delta,
          );
    });

    if (!reducedMotion && particlesRef.current) {
      particlesRef.current.rotation.y = Math.sin(elapsed * 0.12) * 0.035;
    }
  });

  return (
    <>
      <hemisphereLight args={[0xc8ddff, 0x17233a, 2.1]} />
      <directionalLight args={[0xffffff, 3.2]} position={[-3.4, 5, 4]} />
      <pointLight args={[0x38aaff, 18, 9]} position={[2.2, 2.8, -1.8]} />
      <pointLight args={[0xc3e7ff, 10, 8]} position={[-2.5, 2.2, 2]} />

      <mesh position={[0, 2.24, -0.78]} scale={[0.88, 1.92, 1]}>
        <torusGeometry args={[1, 0.012, 8, 100]} />
        <meshBasicMaterial
          color={0x4ba9ff}
          opacity={0.54}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh
        position={[0, 2.24, -0.78]}
        rotation={[0, 0, 0.09]}
        scale={[0.746, 1.51, 1]}
      >
        <torusGeometry args={[0.82, 0.008, 8, 100]} />
        <meshBasicMaterial color={0x93ddff} opacity={0.32} transparent />
      </mesh>
      <mesh
        position={[0, 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.45, 0.64, 1]}
      >
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial
          color={0x2279e9}
          opacity={0.15}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <points geometry={particleGeometry} ref={particlesRef}>
        <pointsMaterial
          color={0x8acfff}
          opacity={0.72}
          size={0.035}
          sizeAttenuation
          transparent
        />
      </points>
      <group ref={robotRef}>
        <primitive dispose={null} object={model} />
      </group>
    </>
  );
}

export default function RobotScene({
  active,
  onUnsupported,
  state,
}: RobotSceneProps) {
  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      if (!gl.getContext().getContextAttributes()) {
        onUnsupported();
        return;
      }
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.25;
    },
    [onUnsupported],
  );

  return (
    <div aria-hidden="true" className="robot-scene-container">
      <Canvas
        camera={{ fov: 34, near: 0.1, far: 100, position: [0, 2.25, 8] }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={handleCreated}
        fallback={
          <div className="robot-fallback">
            <div className="robot-fallback-core" />
          </div>
        }
      >
        <Suspense fallback={null}>
          <RobotModel
            active={active}
            onUnsupported={onUnsupported}
            state={state}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/aether.glb");
