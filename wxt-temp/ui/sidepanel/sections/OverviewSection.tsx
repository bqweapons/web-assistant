import StatCard from '../components/StatCard';
import { mockElements, mockFlows, mockHiddenRules } from '../utils/mockData';

export default function OverviewSection() {
  return (
    <section className="grid gap-2 md:grid-cols-3">
      <StatCard label="Elements" value={String(mockElements.length)} helper="Saved on active page" />
      <StatCard label="Flows" value={String(mockFlows.length)} helper="Reusable action flows" />
      <StatCard label="Hidden rules" value={String(mockHiddenRules.length)} helper="Active rules for this site" />
    </section>
  );
}



