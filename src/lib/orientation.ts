import * as THREE from "three";

// ---------------------------------------------------------------------------
// Device-orientation → quaternion, AR style: hold the phone up and the view
// (or the ship) points where the phone points. Shared by the Construct's
// gyro mode and the Galaxy's motion flight.
// ---------------------------------------------------------------------------

const ZEE = new THREE.Vector3(0, 0, 1);
const orientEuler = new THREE.Euler();
const qScreen = new THREE.Quaternion();
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

export function setQuaternionFromOrientation(
  quaternion: THREE.Quaternion,
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
) {
  orientEuler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(orientEuler);
  quaternion.multiply(Q_FLIP); // look out the back of the device
  quaternion.multiply(qScreen.setFromAxisAngle(ZEE, -screenAngle));
}

/** iOS needs an explicit permission grant from a user gesture; everywhere
 * else orientation events just flow. Resolves to whether gyro is usable. */
export async function requestOrientationPermission(): Promise<boolean> {
  const OrientationEvent = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  try {
    if (typeof OrientationEvent.requestPermission === "function") {
      return (await OrientationEvent.requestPermission()) === "granted";
    }
    return true;
  } catch {
    return false;
  }
}
