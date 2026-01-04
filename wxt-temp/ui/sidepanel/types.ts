import type { ReactNode } from 'react';

export type HeaderAction = {
  label: string;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  icon?: ReactNode;
};

export type AppHeaderProps = {
  title: string;
  context: string;
  actions: HeaderAction[];
};

export type TabDefinition = {
  id: string;
  label: string;
  icon?: ReactNode;
};

export type TabBarProps = {
  tabs: TabDefinition[];
  activeId: string;
  onChange: (id: string) => void;
};

export type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export type SettingsPopoverProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};
