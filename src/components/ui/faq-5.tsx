'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Faq5Props {
  badge?: string;
  heading?: string;
  description?: string;
  faqs?: FaqItem[];
}

const defaultFaqs: FaqItem[] = [
  {
    question: "What is a FAQ and why is it important?",
    answer:
      "FAQ stands for Frequently Asked Questions. It is a list that provides answers to common questions people may have about a specific product, service, or topic.",
  },
  {
    question: "Why should I use a FAQ on my website or app?",
    answer:
      "Utilizing a FAQ section on your website or app is a practical way to offer instant assistance to your users or customers. Instead of waiting for customer support responses, they can find quick answers to commonly asked questions.",
  },
  {
    question: "How do I effectively create a FAQ section?",
    answer:
      "Creating a FAQ section starts with gathering the most frequent questions you receive from your users or customers. Once you have a list, you need to write clear, detailed, and helpful answers to each question.",
  },
  {
    question: "What are the benefits of having a well-maintained FAQ section?",
    answer:
      "There are numerous advantages to maintaining a robust FAQ section. Firstly, it provides immediate answers to common queries, which improves the user experience.",
  },
]

export const Faq5 = ({
  badge = "FAQ",
  heading = "Common Questions & Answers",
  description = "Find out all the essential details about our platform and how it can serve your needs.",
  faqs = defaultFaqs,
}: Faq5Props) => {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-28 bg-gray-50/70">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-14">
          <Badge variant="outline" className="text-[11px] tracking-wide font-semibold uppercase mb-5">
            {badge}
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900">
            {heading}
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-md mx-auto">
            {description}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = open === index
            return (
              <button
                key={index}
                onClick={() => setOpen(isOpen ? null : index)}
                className="w-full text-left bg-white border border-gray-100 rounded-2xl px-6 py-5 hover:border-gray-200 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-gray-900 text-[15px]">{faq.question}</span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
                <div
                  className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-gray-500 leading-relaxed pr-8">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
