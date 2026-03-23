"use client";

import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";
import { motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";

const testimonialsEN = [
  {
    text: "DataLaser replaced our entire data analyst workflow. I get a better briefing every morning than I used to get after paying €8k/month for a consultant.",
    image: "https://randomuser.me/api/portraits/women/1.jpg",
    name: "Sarah K.",
    role: "Head of Growth",
  },
  {
    text: "Connected our Postgres DB and Shopify store in 3 minutes. The AI found a revenue leak we'd been missing for 6 months.",
    image: "https://randomuser.me/api/portraits/men/2.jpg",
    name: "Marcus T.",
    role: "Founder & CEO",
  },
  {
    text: "I ask it questions every morning like I'm talking to a CFO. It knows our numbers, our seasonality, and it remembers context.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
    name: "Priya N.",
    role: "CEO, E-commerce",
  },
  {
    text: "The auto-analysis found a correlation between our ad spend and churn that nobody on the team had noticed. Game changer.",
    image: "https://randomuser.me/api/portraits/men/4.jpg",
    name: "David M.",
    role: "Marketing Director",
  },
  {
    text: "We went from spending 3 hours in Excel every Monday to getting our weekly report automatically. The quality is better too.",
    image: "https://randomuser.me/api/portraits/women/5.jpg",
    name: "Elena R.",
    role: "Operations Manager",
  },
  {
    text: "Finally a tool that doesn't require a data engineer to set up. Upload CSV, get insights. That's exactly what our Mittelstand clients need.",
    image: "https://randomuser.me/api/portraits/men/6.jpg",
    name: "Thomas B.",
    role: "Unternehmensberater",
  },
  {
    text: "The German language support and DATEV integration made this a no-brainer for our Controlling team.",
    image: "https://randomuser.me/api/portraits/women/7.jpg",
    name: "Anna S.",
    role: "CFO, Manufacturing",
  },
  {
    text: "Our team uses the Studio notebook daily. It's like Jupyter but actually understands our business data.",
    image: "https://randomuser.me/api/portraits/men/8.jpg",
    name: "Raj P.",
    role: "Data Lead",
  },
  {
    text: "The auto-generated insights caught an inventory anomaly that would have cost us €50K. Paid for itself in the first week.",
    image: "https://randomuser.me/api/portraits/women/9.jpg",
    name: "Lisa W.",
    role: "Supply Chain Manager",
  },
];

const testimonialsDE = [
  {
    text: "DataLaser hat unseren gesamten Datenanalyse-Workflow ersetzt. Ich bekomme jeden Morgen ein besseres Briefing als je zuvor von einem €8.000/Monat Berater.",
    image: "https://randomuser.me/api/portraits/women/1.jpg",
    name: "Sarah K.",
    role: "Head of Growth",
  },
  {
    text: "Postgres-DB und Shopify-Store in 3 Minuten verbunden. Die KI hat ein Umsatzleck gefunden, das wir 6 Monate übersehen hatten.",
    image: "https://randomuser.me/api/portraits/men/2.jpg",
    name: "Marcus T.",
    role: "Gründer & CEO",
  },
  {
    text: "Ich stelle jeden Morgen Fragen wie an einen CFO. Es kennt unsere Zahlen, unsere Saisonalität und erinnert sich an den Kontext.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
    name: "Priya N.",
    role: "CEO, E-Commerce",
  },
  {
    text: "Die Auto-Analyse fand eine Korrelation zwischen Werbeausgaben und Abwanderung, die niemand im Team bemerkt hatte.",
    image: "https://randomuser.me/api/portraits/men/4.jpg",
    name: "David M.",
    role: "Marketing-Leiter",
  },
  {
    text: "Statt 3 Stunden Excel jeden Montag bekommen wir jetzt den Wochenbericht automatisch. Die Qualität ist auch besser.",
    image: "https://randomuser.me/api/portraits/women/5.jpg",
    name: "Elena R.",
    role: "Operations Managerin",
  },
  {
    text: "Endlich ein Tool, das keinen Data Engineer zur Einrichtung braucht. CSV hochladen, Erkenntnisse erhalten. Genau das, was unsere Mittelstandskunden brauchen.",
    image: "https://randomuser.me/api/portraits/men/6.jpg",
    name: "Thomas B.",
    role: "Unternehmensberater",
  },
  {
    text: "Die deutsche Sprachunterstützung und DATEV-Integration machten dies zur einfachen Entscheidung für unser Controlling-Team.",
    image: "https://randomuser.me/api/portraits/women/7.jpg",
    name: "Anna S.",
    role: "CFO, Fertigung",
  },
  {
    text: "Unser Team nutzt das Studio-Notebook täglich. Es ist wie Jupyter, versteht aber tatsächlich unsere Geschäftsdaten.",
    image: "https://randomuser.me/api/portraits/men/8.jpg",
    name: "Raj P.",
    role: "Data Lead",
  },
  {
    text: "Die automatisch generierten Erkenntnisse haben eine Lagerbestandsanomalie entdeckt, die uns €50.000 gekostet hätte.",
    image: "https://randomuser.me/api/portraits/women/9.jpg",
    name: "Lisa W.",
    role: "Supply Chain Managerin",
  },
];

export function Testimonials() {
  const t = useTranslations();
  const locale = useLocale();

  const testimonials = locale === "de" ? testimonialsDE : testimonialsEN;
  const firstColumn = testimonials.slice(0, 3);
  const secondColumn = testimonials.slice(3, 6);
  const thirdColumn = testimonials.slice(6, 9);

  return (
    <section className="bg-gray-50/70 pt-16 pb-20 relative">
      <div className="container z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
        >
          <div className="flex justify-center">
            <div className="border py-1 px-4 rounded-lg text-sm font-medium text-violet-600 border-violet-200 bg-violet-50">
              {t("landing.testimonialTitle")}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5 text-gray-900">
            {locale === "de"
              ? "Was unsere Nutzer sagen"
              : "What our users say"}
          </h2>
          <p className="text-center mt-5 opacity-75 text-gray-500">
            {locale === "de"
              ? "Erfahren Sie, wie DataLaser Unternehmen hilft, ihre Daten zu verstehen."
              : "See how DataLaser helps businesses understand their data."}
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn
            testimonials={secondColumn}
            className="hidden md:block"
            duration={19}
          />
          <TestimonialsColumn
            testimonials={thirdColumn}
            className="hidden lg:block"
            duration={17}
          />
        </div>
      </div>
    </section>
  );
}
