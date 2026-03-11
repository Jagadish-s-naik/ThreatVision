import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Shield, Activity, Database, 
  Zap, Menu, X, Network, Link2, 
  AlertTriangle, Users, BookOpen, Mail,
  Home, Info, Tag, LogIn, HelpCircle
} from 'lucide-react';
import PricingSection6 from './ui/pricing-section-4.jsx';
import { FocusCards } from './ui/focus-cards.jsx';
import HoverFooter from './ui/hover-footer.jsx';
import { ExpandableTabs } from './ui/expandable-tabs.jsx';

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const Navbar = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navTabs = [
    { title: "Home", icon: Home, href: "#" },
    { title: "Features", icon: Info, href: "#features" },
    { title: "How it Works", icon: HelpCircle, href: "#how-it-works" },
    { title: "Pricing", icon: Tag, href: "#pricing" },
    { title: "Contact", icon: Mail, href: "#contact" },
    { type: "separator" },
    { title: "Login", icon: LogIn, href: "#" },
  ];

  // Using a custom onChange handler to catch clicks and scroll
  const handleTabChange = (index) => {
    if (index === null) return;
    const tab = navTabs[index];
    if (tab && tab.href && tab.href.startsWith('#') && tab.href !== '#') {
       scrollTo(tab.href.substring(1));
    } else if (tab && (tab.title === "Login" || tab.title === "Home")) {
       if (tab.title === "Login") {
          onGetStarted();
       } else if (tab.title === "Home") {
          window.scrollTo({top: 0, behavior: 'smooth'});
       }
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#030303]/70 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
        <div className="flex items-center gap-2 cursor-pointer w-full md:w-auto justify-between md:justify-start" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="flex items-center gap-2">
             <Shield className="w-8 h-8 text-teal-400" />
             <span className="text-xl font-bold tracking-tight text-white">
               Threat<span className="text-teal-400">Vision</span>
             </span>
          </div>
          <button onClick={onGetStarted} className="md:hidden px-4 py-1.5 text-xs font-semibold text-[#030303] bg-teal-400 hover:bg-teal-300 rounded-lg transition-all shadow-[0_0_10px_rgba(45,212,191,0.3)]">
            Start
          </button>
        </div>

        {/* Central Animated Tabs */}
        <div className="w-full md:w-auto flex justify-center mt-2 md:mt-0">
           <ExpandableTabs tabs={navTabs} onChange={handleTabChange} activeColor="text-teal-400" className="border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.1)] py-1" />
        </div>

        {/* Right CTA */}
        <div className="hidden md:flex items-center">
          <button onClick={onGetStarted} className="px-6 py-2.5 text-sm font-semibold text-[#030303] bg-teal-400 hover:bg-teal-300 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(45,212,191,0.5)] hover:scale-105">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
};

const HeroSection = ({ onGetStarted }) => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Live Network Intelligence
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
            See through the <br/><span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">noise.</span><br/>
            Detect fraud before it happens.
          </h1>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
            AI-powered transaction intelligence that uncovers hidden money-laundering rings, mule networks, and suspicious payment patterns in real time.
          </p>
          
          <ul className="space-y-4 mb-10">
            {['Detect circular money-flows across accounts', 'Spot mule accounts and shell entities instantly', 'Prioritize high-risk alerts with explainable AI'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-300">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center">
                  <CheckIcon className="w-3 h-3 text-teal-400" />
                </div>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button onClick={onGetStarted} className="px-8 py-4 text-base font-semibold text-[#030303] bg-teal-400 hover:bg-teal-300 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(45,212,191,0.4)] hover:-translate-y-1 flex items-center justify-center gap-2">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onGetStarted} className="px-8 py-4 text-base font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center">
              View Demo
            </button>
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
            No credit card required. Instant sandbox access.
          </p>
        </div>

        <div className="relative w-full aspect-square md:aspect-video lg:aspect-square flex items-center justify-center scale-95 hover:scale-100 transition-transform duration-700">
          <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 rounded-2xl border border-white/10 backdrop-blur-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="h-12 border-b border-white/10 bg-white/5 flex items-center px-4 justify-between">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-rose-500" />
                 <div className="w-3 h-3 rounded-full bg-amber-500" />
                 <div className="w-3 h-3 rounded-full bg-green-500" />
               </div>
               <span className="text-xs text-slate-400 font-mono tracking-wider">Suspicious Transaction Network</span>
            </div>
            <div className="flex-1 p-6 relative flex flex-col">
              <div className="flex justify-between gap-4 mb-8">
                <div className="bg-[#0f1115] border border-white/5 rounded-lg p-3 flex-1 flex flex-col items-center justify-center shadow-inner hover:scale-105 transition-transform cursor-default">
                  <span className="text-rose-400 text-2xl font-bold">4</span>
                  <span className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase tracking-widest text-center">High-Risk Rings</span>
                </div>
                <div className="bg-[#0f1115] border border-white/5 rounded-lg p-3 flex-1 flex flex-col items-center justify-center shadow-inner hover:scale-105 transition-transform cursor-default">
                  <span className="text-amber-400 text-2xl font-bold">26</span>
                  <span className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase tracking-widest text-center">Flagged Accounts</span>
                </div>
                <div className="bg-[#0f1115] border border-white/5 rounded-lg p-3 flex-1 flex flex-col items-center justify-center shadow-inner hover:scale-105 transition-transform cursor-default">
                  <span className="text-indigo-400 text-2xl font-bold">+37%</span>
                  <span className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase tracking-widest text-center">Anomalous Volume</span>
                </div>
              </div>

              <div className="flex-1 relative border border-white/5 rounded-xl bg-[#030303] overflow-hidden flex items-center justify-center group cursor-pointer">
                {/* Default Image: Cybercrime laptop */}
                <img 
                  src="/cyber-crime.jpg" 
                  alt="Cybercrime Investigation" 
                  className="absolute inset-0 object-cover w-full h-full opacity-80 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:opacity-0 group-hover:scale-105" 
                />
                
                {/* Hover Image: ThreatVision Protection */}
                <img 
                  src="/cyber-shield.jpg" 
                  alt="ThreatVision Protection" 
                  className="absolute inset-0 object-cover w-full h-full opacity-0 scale-95 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:opacity-100 group-hover:scale-100" 
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-[#030303]/80 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeaturesSection = () => {
  const features = [
    {
      title: "Circular Flow Detection",
      src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop",
      desc: "Detect repeated loops of funds between the same group of accounts to highlight potential layering schemes.",
      bullets: [
        "Continuous cycle graph tracking",
        "Layering phase identification",
        "Risk scoring based on velocity"
      ]
    },
    {
      title: "Central Hub Identification",
      src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
      desc: "Automatically flag central hub accounts that receive many medium-value payments and redistribute large sums back into the network.",
      bullets: [
        "Fan-in / Fan-out anomaly detection",
        "Accumulation threshold alerts",
        "Historical beneficiary matching"
      ]
    },
    {
      title: "Shell Entity Tracing",
      src: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop",
      desc: "Track flows through shell-style accounts used to obscure the final beneficiary. Our ML models learn the hallmarks of synthetic identities.",
      bullets: [
        "Synthetic identity detection",
        "Offshore hopping alerts",
        "Multi-hop beneficiary tracing"
      ]
    },
    {
      title: "Anomaly Scoring",
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
      desc: "Score unusual payment behavior for merchants and corporates, highlighting suspicious spikes or sudden out-of-character transaction volumes.",
      bullets: [
        "Dynamic behavioral baselines",
        "Sudden spike visualization",
        "Expected-vs-actual variance"
      ]
    },
    {
      title: "Fee Monitoring",
      src: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=2070&auto=format&fit=crop",
      desc: "Monitor structured payments like tuition fees to detect misuse of refund flows that are frequently exploited as cash-out channels.",
      bullets: [
        "Refund pattern heuristics",
        "Structuring detection",
        "Cross-border fee flags"
      ]
    },
    {
      title: "Micro-Spend Signals",
      src: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=2070&auto=format&fit=crop",
      desc: "Enrich risk scoring using small merchants to profile mule accounts and distinguish normal consumer behavior from organized fraud rings.",
      bullets: [
        "Lifestyle marker indexing",
        "Legitimate behavior profiling",
        "False-positive reduction AI"
      ]
    }
  ];

  return (
    <section id="features" className="py-24 bg-[#0a0c10] border-t border-white/5 relative z-10 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">
            Intelligence built for <span className="text-teal-400">complex networks</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Our detection engine analyzes the complete topology of your financial data in real-time. Hover over the cards to learn more.
          </p>
        </div>

        <FocusCards cards={features} />
      </div>
    </section>
  );
};

const HowItWorksSection = () => {
  const steps = [
    {
      num: "01",
      title: "Ingest Transactions",
      desc: "Connect your core banking or payment data stream via API or batch CSV. ThreatVision normalizes and enriches every transaction in real time.",
      icon: <Database className="w-8 h-8 text-teal-400" />
    },
    {
      num: "02",
      title: "Analyze Network Patterns",
      desc: "We build dynamic graphs of senders and receivers to detect rings, hubs, shell chains, and anomalous merchants using advanced machine-learning.",
      icon: <Network className="w-8 h-8 text-indigo-400" />
    },
    {
      num: "03",
      title: "Act on High-Risk Alerts",
      desc: "Analysts get explainable alerts, visual flow maps, and exportable case files to accelerate investigations and regulatory reporting.",
      icon: <Shield className="w-8 h-8 text-rose-400" />
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#030303] relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-16 text-center">
          How <span className="text-teal-400">ThreatVision</span> works
        </h2>

        <div className="flex flex-col md:flex-row gap-8 relative">
          <div className="hidden md:block absolute top-[40px] left-1/6 w-2/3 h-0.5 bg-gradient-to-r from-teal-500/20 via-indigo-500/50 to-rose-500/20 z-0" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="flex-1 relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-[#0f1115] border border-white/10 flex items-center justify-center mb-6 shadow-xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {step.icon}
                <div className="absolute -top-2 -right-2 text-4xl font-black text-white/[0.03] select-none">{step.num}</div>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};



const ContactSection = () => {
    return (
      <section id="contact" className="py-24 bg-[#0a0c10] border-t border-white/5 relative z-10 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-start">
               
               {/* Left Column */}
               <div className="flex flex-col relative z-10 pt-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#030303] border border-white/10 flex items-center justify-center mb-8 relative group shadow-lg">
                     {/* Glow effect */}
                     <div className="absolute inset-0 bg-teal-500/20 blur-xl group-hover:bg-teal-500/30 transition-colors rounded-2xl" />
                     <div className="absolute bottom-0 w-8 h-[2px] bg-gradient-to-r from-transparent via-teal-500 to-transparent shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                     <Mail className="w-6 h-6 text-teal-400 relative z-10" />
                  </div>
                  
                  <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">Contact us</h2>
                  <p className="text-slate-400 text-lg mb-12 max-w-md">
                     We are always looking for ways to improve our products and services. Contact us and let us know how we can help you.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-200 mb-16 px-1">
                     <span>contact@threatvision.ai</span>
                     <span className="text-slate-600 font-black">•</span>
                     <span>+1 (800) 123 XX21</span>
                     <span className="text-slate-600 font-black">•</span>
                     <span>support@threatvision.ai</span>
                  </div>

                  {/* The contact details end here, map was removed as requested */}
               </div>

               {/* Right Column / Form Container */}
               <div className="relative rounded-3xl bg-[#0f1115] border border-white/5 p-8 md:p-10 shadow-2xl xl:ml-8">
                  {/* CSS Grid Background */}
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDAuNWg0ME0wIDEwLjVoNDBNMCAyMC41aDQwTTAgMzAuNWg0ME0wLjUgMHY0ME0xMC41IDB2NDBNMjAuNSAwdjQwTTMwLjUgMHY0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDIpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)] opacity-100 rounded-3xl" />
                  
                  {/* Scattered darker grid blocks (abstract design) */}
                  <div className="absolute top-10 right-10 w-10 h-10 bg-white/[0.02]" />
                  <div className="absolute top-20 right-20 w-10 h-10 bg-white/[0.02]" />
                  <div className="absolute top-10 right-20 w-10 h-20 bg-white/[0.02]" />

                  {/* Form */}
                  <form className="relative z-10 space-y-5" onSubmit={e=>e.preventDefault()}>
                     <div>
                        <label className="block text-sm font-semibold text-slate-200 mb-2">Full name</label>
                        <input type="text" className="w-full bg-[#1a1c23] border border-transparent rounded-xl px-4 py-3.5 text-slate-300 focus:outline-none focus:border-white/10 focus:bg-[#20232b] transition-colors placeholder:text-slate-600 shadow-inner" placeholder="Manu Arora" />
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-200 mb-2">Email Address</label>
                        <input type="email" className="w-full bg-[#1a1c23] border border-transparent rounded-xl px-4 py-3.5 text-slate-300 focus:outline-none focus:border-white/10 focus:bg-[#20232b] transition-colors placeholder:text-slate-600 shadow-inner" placeholder="support@aceternity.com" />
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-200 mb-2">Company</label>
                        <input type="text" className="w-full bg-[#1a1c23] border border-transparent rounded-xl px-4 py-3.5 text-slate-300 focus:outline-none focus:border-white/10 focus:bg-[#20232b] transition-colors placeholder:text-slate-600 shadow-inner" placeholder="Aceternity Labs LLC" />
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-200 mb-2">Message</label>
                        <textarea rows="4" className="w-full bg-[#1a1c23] border border-transparent rounded-xl px-4 py-3.5 text-slate-300 focus:outline-none focus:border-white/10 focus:bg-[#20232b] transition-colors resize-none placeholder:text-slate-600 shadow-inner" placeholder="Type your message here" />
                     </div>
                     <div className="pt-2">
                        <button className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium text-sm transition-colors border border-transparent hover:border-white/10">
                            Submit
                        </button>
                     </div>
                  </form>
               </div>
            </div>
        </div>
      </section>
    );
};

const CallToActionSection = ({ onGetStarted }) => {
  return (
    <section className="py-24 bg-[#030303] relative px-4 sm:px-6 z-10">
      <div className="max-w-5xl mx-auto bg-gradient-to-r from-teal-900/40 to-indigo-900/40 border border-teal-500/30 rounded-3xl p-10 md:p-16 text-center shadow-[0_0_50px_rgba(20,184,166,0.15)] relative overflow-hidden group">
         <div className="absolute inset-0 bg-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
         <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to see ThreatVision on your data?</h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Spin up a sandbox, stream a test CSV, and watch suspicious patterns light up in seconds.
            </p>
            <button onClick={onGetStarted} className="px-10 py-5 bg-teal-400 hover:bg-teal-300 text-[#030303] text-lg font-bold rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(45,212,191,0.5)]">
               Get Started in 5 Minutes
            </button>
            <p className="mt-6 text-sm text-slate-400 font-medium">Built for banks, fintechs, and payment processors.</p>
         </div>
      </div>
    </section>
  );
};

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="h-screen overflow-y-auto bg-[#030303] text-slate-200 font-sans overflow-x-hidden selection:bg-teal-500/30">
      <Navbar onGetStarted={onGetStarted} />
      <HeroSection onGetStarted={onGetStarted} />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection6 />
      <ContactSection />
      <CallToActionSection onGetStarted={onGetStarted} />
      <HoverFooter />
    </div>
  );
}
