import type { CSSProperties } from "react";
import type { UseCase } from "../types";

export type WheelSegment = {
  index: number;
  id: number;
  title: string;
  label: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
};

export function buildWheelSegments(useCases: UseCase[]): WheelSegment[] {
  if (!useCases.length) return [];
  const size = 360 / useCases.length;
  return useCases.map((useCase, index) => {
    const startAngle = index * size;
    const endAngle = startAngle + size;
    return {
      index,
      id: useCase.id,
      title: useCase.title,
      label: String(index + 1),
      startAngle,
      endAngle,
      midAngle: startAngle + size / 2,
    };
  });
}

export function calculateWheelSpin({
  segmentCount,
  targetIndex,
  currentRotation = 0,
  extraTurns = 6,
}: {
  segmentCount: number;
  targetIndex: number;
  currentRotation?: number;
  extraTurns?: number;
}) {
  if (segmentCount < 1) {
    throw new Error("segmentCount must be greater than 0");
  }
  if (targetIndex < 0 || targetIndex >= segmentCount) {
    throw new Error("targetIndex must point to an existing segment");
  }

  const segmentSize = 360 / segmentCount;
  const targetCenterAngle = targetIndex * segmentSize + segmentSize / 2;
  const normalizedRotation = ((currentRotation % 360) + 360) % 360;
  const rotationToPointer = (360 - ((targetCenterAngle + normalizedRotation) % 360)) % 360;
  const finalRotation = currentRotation + extraTurns * 360 + rotationToPointer;

  return {
    targetCenterAngle,
    finalRotation,
  };
}

export function getNextRevealIndex({ assignmentCount, revealedCount }: { assignmentCount: number; revealedCount: number }) {
  if (revealedCount >= assignmentCount) return null;
  return revealedCount;
}

export function getTombolaReadiness({ teamCount, useCaseCount }: { teamCount: number; useCaseCount: number }) {
  if (teamCount < 1) {
    return {
      ready: false,
      message: "Primero genera equipos para iniciar la ruleta.",
    };
  }

  if (useCaseCount < 1) {
    return {
      ready: false,
      message: "Agrega al menos un caso de uso para iniciar la ruleta.",
    };
  }

  if (useCaseCount < teamCount) {
    return {
      ready: true,
      message: "Listo para sortear. Hay menos casos que equipos, algunos casos se repetiran.",
    };
  }

  return {
    ready: true,
    message: "Listo para sortear.",
  };
}

export function isTombolaComplete({ assignmentCount, revealedCount }: { assignmentCount: number; revealedCount: number }) {
  return assignmentCount > 0 && revealedCount >= assignmentCount;
}

export function buildWheelStyle({
  background,
  rotation,
  startRotation,
  spinning,
}: {
  background: string;
  rotation: number;
  startRotation: number;
  spinning: boolean;
}): CSSProperties {
  const style: CSSProperties & Record<string, string | number> = {
    background,
    transform: `rotate(${rotation}deg)`,
  };

  if (spinning) {
    style["--wheel-from"] = `${startRotation}deg`;
    style["--wheel-to"] = `${rotation}deg`;
    style.animation = "wheel-spin 5.2s cubic-bezier(0.08, 0.88, 0.12, 1) forwards";
  }

  return style;
}
