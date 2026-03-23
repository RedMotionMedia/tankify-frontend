type Props = {
    title: string;
    value: string;
    valueClassName?: string;
};

export default function StatCard({
                                     title,
                                     value,
                                     valueClassName = "text-gray-900",
                                 }: Props) {
    return (
        <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">{title}</div>
            <div className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</div>
        </div>
    );
}