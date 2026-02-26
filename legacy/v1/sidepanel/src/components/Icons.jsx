import React from 'react';
import {
  ArrowPathIcon,
  CursorArrowRaysIcon,
  PencilSquareIcon,
  TrashIcon as HeroTrashIcon,
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
  XMarkIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  StopCircleIcon,
  CheckIcon,
  PlusIcon as HeroPlusIcon,
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

export function CloseIcon(props) {
  return <XMarkIcon aria-hidden="true" {...props} />;
}

export function SaveIcon(props) {
  return <CheckIcon aria-hidden="true" {...props} />;
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

export function PlusIcon(props) {
  return <HeroPlusIcon aria-hidden="true" {...props} />;
}
