"use client";
import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "./card";
import { Sparkles as SparklesComp } from "./sparkles";
import { TimelineContent } from "./timeline-animation";
import { VerticalCutReveal } from "./vertical-cut-reveal";
import { cn } from "../../lib/utils";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Starter",
    description: "For small teams and startups.",
    price: 499,
    yearlyPrice: 4990,
    buttonText: "Start Trial",
    buttonVariant: "outline",
    includes: [
      "Core features:",
      "Up to 100k tx/month",
      "Basic pattern detection",
      "Email support",
    ],
  },
  {
    name: "Professional",
    description: "For growing fintechs.",
    price: 1299,
    yearlyPrice: 12990,
    buttonText: "Get Started",
    buttonVariant: "default",
    popular: true,
    includes: [
      "Everything in Starter, plus:",
      "Up to 1M tx/month",
      "Advanced ML scoring",
      "API Access",
    ],
  },
  {
    name: "Enterprise",
    description: "For large institutions.",
    price: "Custom",
    yearlyPrice: "Custom",
    buttonText: "Contact Sales",
    buttonVariant: "outline",
    includes: [
      "Everything in Professional, plus:",
      "Unlimited volume",
      "Custom models",
      "24/7 Phone SLA",
    ],
  },
];

const PricingSwitch = ({ onSwitch }) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full bg-neutral-900 border border-gray-700 p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit h-10  rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "0" ? "text-white" : "text-gray-200",
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-10 w-full rounded-full border-4 shadow-sm shadow-teal-500/50 border-teal-500 bg-gradient-to-t from-teal-400 to-teal-500"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "1" ? "text-white" : "text-gray-200",
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-10 w-full  rounded-full border-4 shadow-sm shadow-blue-600 border-blue-600 bg-gradient-to-t from-blue-500 to-blue-600"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">Yearly</span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection6() {
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef(null);

  const revealVariants = {
    visible: (i) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value) =>
    setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className=" min-h-screen pt-24 pb-12 mx-auto relative bg-[#030303] overflow-x-hidden"
      ref={pricingRef}
    >
      <TimelineContent
        animationNum={4}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute top-0 h-96 w-screen overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)] pointer-events-none"
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#ffffff2c_1px,transparent_1px),linear-gradient(to_bottom,#3a3a3a01_1px,transparent_1px)] bg-[size:70px_80px] "></div>
        <SparklesComp
          density={1800}
          direction="bottom"
          speed={1}
          color="#FFFFFF"
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
        />
      </TimelineContent>
      <TimelineContent
        animationNum={5}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute left-0 top-0 w-full h-full flex flex-col items-start justify-start content-start flex-none flex-nowrap gap-2.5 overflow-hidden p-0 z-0 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]"
      >
        <div className="framer-1i5axl2">
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #14b8a6",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
              opacity: 0.3,
            }}
            data-border="true"
            data-framer-name="Ellipse 1"
          ></div>
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #14b8a6",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
              opacity: 0.3,
            }}
            data-border="true"
            data-framer-name="Ellipse 2"
          ></div>
        </div>
      </TimelineContent>

      <article className="text-center mb-6 pt-32 max-w-3xl mx-auto space-y-2 relative z-50">
        <h2 className="text-4xl font-medium text-white">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-center "
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0, // First element
            }}
          >
            Plans that works best for your
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-gray-300"
        >
          Trusted by millions, We help teams all around the world, Explore which
          option is right for you.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} />
        </TimelineContent>
      </article>

      <div
        className="absolute top-[10%] left-[10%] right-[10%] w-[80%] h-[80%] z-0 pointer-events-none"
        style={{
          backgroundImage: `
        radial-gradient(circle at center, #6366f1 0%, transparent 70%)
      `,
          opacity: 0.2,
          mixBlendMode: "multiply",
        }}
      />

      <div className="grid md:grid-cols-3 max-w-5xl gap-4 py-6 mx-auto ">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={`relative text-white border-neutral-800 ${
                plan.popular
                  ? "bg-gradient-to-r from-[#0f1115] via-[#0a0c10] to-[#0f1115] shadow-[0_0_30px_rgba(20,184,166,0.1)] border-teal-500 z-20"
                  : "bg-gradient-to-r from-[#0f1115] via-[#0a0c10] to-[#0f1115] z-10"
              }`}
            >
              <CardHeader className="text-left ">
                <div className="flex justify-between">
                  <h3 className="text-3xl mb-2">{plan.name}</h3>
                </div>
                <div className="flex items-baseline">
                  {typeof plan.price === "number" ? (
                    <>
                      <span className="text-4xl font-semibold ">
                        $
                        <NumberFlow
                          format={{
                            currency: "USD",
                          }}
                          value={isYearly ? plan.yearlyPrice : plan.price}
                          className="text-4xl font-semibold inline-block"
                        />
                      </span>
                      <span className="text-gray-300 ml-1">
                        /{isYearly ? "year" : "month"}
                      </span>
                    </>
                  ) : (
                      <span className="text-4xl font-semibold">{plan.price}</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-4">{plan.description}</p>
              </CardHeader>

              <CardContent className="pt-0">
                <button
                  className={`w-full mb-6 p-4 text-xl rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? "bg-teal-400 hover:bg-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.4)] hover:-translate-y-1 text-[#030303]"
                      : plan.buttonVariant === "outline"
                        ? "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                        : ""
                  }`}
                >
                  {plan.buttonText}
                </button>

                <div className="space-y-3 pt-4 border-t border-neutral-700">
                  <h4 className="font-medium text-base mb-3">
                    {plan.includes[0]}
                  </h4>
                  <ul className="space-y-2">
                    {plan.includes.slice(1).map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center gap-2"
                      >
                        <span className="h-2.5 w-2.5 bg-neutral-500 rounded-full grid place-content-center"></span>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}
