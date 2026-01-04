import StatCard from '../components/StatCard';

export default function OverviewSection() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard label="Elements" value="0" helper="Saved on active page" />
      <StatCard label="Flows" value="0" helper="Reusable action flows" />
      <StatCard label="Hidden rules" value="0" helper="Active rules for this site" />
    </section>
  );
}
