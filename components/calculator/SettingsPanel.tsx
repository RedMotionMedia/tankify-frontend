import { TranslationSchema } from "@/config/i18n";
import { Language } from "@/types/tankify";

type Props = {
    language: Language;
    setLanguage: (language: Language) => void;
    t: TranslationSchema;
};

export default function SettingsPanel({
                                          language,
                                          setLanguage,
                                          t,
                                      }: Props) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-bold">{t.settings.title}</h2>
            </div>

            <div>
                <label className="mb-2 block text-sm font-medium">
                    {t.settings.language}
                </label>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none"
                >
                    <option value="de">{t.settings.german}</option>
                    <option value="en">{t.settings.english}</option>
                </select>
            </div>
        </section>
    );
}