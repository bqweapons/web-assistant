import React from 'react';
import {
  ArrowPathIcon,
  CursorArrowRaysIcon,
  PencilSquareIcon,
  TrashIcon as HeroTrashIcon,
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  StopCircleIcon,
} from '@heroicons/react/20/solid';

export function RefreshIcon(props) {
  return <ArrowPathIcon aria-hidden="true" {...props} />;
}

export function FocusIcon(props) {
  return <CursorArrowRaysIcon aria-hidden="true" {...props} />;
}

export function EditIcon(props) {
  return <PencilSquareIcon aria-hidden="true" {...props} />;
}

export function TrashIcon(props) {
  return <HeroTrashIcon aria-hidden="true" {...props} />;
}

export function OpenPageIcon(props) {
  return <ArrowTopRightOnSquareIcon aria-hidden="true" {...props} />;
}

export function ClearPageIcon(props) {
  return <XCircleIcon aria-hidden="true" {...props} />;
}

export function PlayIcon(props) {
  return <PlayCircleIcon aria-hidden="true" {...props} />;
}

export function PauseIcon(props) {
  return <PauseCircleIcon aria-hidden="true" {...props} />;
}

export function StopIcon(props) {
  return <StopCircleIcon aria-hidden="true" {...props} />;
}
