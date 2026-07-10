import * as THREE from "three";

export const MENU_BOARD_POS = { x: -14, z: -12 };
export const MENU_BOARD_RADIUS = 7;

export function createMenuBoard(
  scene: THREE.Scene,
  accent: THREE.Color,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(MENU_BOARD_POS.x, 0, MENU_BOARD_POS.z);
  group.rotation.y = Math.PI / 4;
  scene.add(group);

  const postMat = new THREE.MeshBasicMaterial({ color: 0x10182e });
  const trimMat = new THREE.MeshBasicMaterial({ color: accent });

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 3.6, 0.35),
    postMat,
  );
  post.position.y = 1.8;
  group.add(post);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.4, 0.2),
    postMat,
  );
  board.position.y = 3.2;
  group.add(board);

  const boardTrim = new THREE.Mesh(
    new THREE.BoxGeometry(3.35, 2.55, 0.22),
    trimMat,
  );
  boardTrim.position.y = 3.2;
  group.add(boardTrim);

  return group;
}
