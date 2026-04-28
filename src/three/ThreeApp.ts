import * as THREE from 'three';
import { Config } from '../app/config';

/**
 * ThreeApp — owns the renderer, camera, scene and resize handling.
 * Intentionally small; higher-level logic lives in SceneManager and the
 * game scenes themselves.
 */
export class ThreeApp {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly canvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Config.renderer.pixelRatioMax));
    this.renderer.setClearColor(Config.renderer.clearColor, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.renderer.clearColor);
    this.scene.fog = new THREE.FogExp2(Config.renderer.clearColor, 0.08);

    this.camera = new THREE.PerspectiveCamera(
      Config.renderer.fov,
      1,
      Config.renderer.near,
      Config.renderer.far,
    );
    this.camera.position.set(...(Config.camera.overview.position as unknown as [number, number, number]));
    this.camera.lookAt(new THREE.Vector3(...(Config.camera.overview.lookAt as unknown as [number, number, number])));

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    window.addEventListener('resize', this.resize);
  }

  render(): void { this.renderer.render(this.scene, this.camera); }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth  || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
