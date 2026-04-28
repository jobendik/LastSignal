import * as THREE from 'three';

/**
 * A tiny set of reusable helper builders. Centralising these avoids
 * scattered magic numbers in the scene factories and makes it easy to
 * swap in real GLB assets later (each factory returns a THREE.Object3D
 * with known local coordinates).
 */

export function boxWithEdges(
  w: number, h: number, d: number,
  color: number, edgeColor = 0x000000, opacity = 1,
): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.85,
    transparent: opacity < 1,
    opacity,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.35 }),
  );
  group.add(edges);
  return group;
}

export function cylinderKnob(
  radius: number, height: number, color: number,
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: 0.5, roughness: 0.55,
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function ledIndicator(color: number, size = 0.012): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 10), mat);
  // Small halo via point light — but we keep it cheap: just a mesh + emissive.
  return m;
}

export function thinPanel(
  w: number, h: number, color: number, emissive = 0x000000, emissiveIntensity = 0,
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: 0.2, roughness: 0.9,
    emissive: new THREE.Color(emissive), emissiveIntensity,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return m;
}
