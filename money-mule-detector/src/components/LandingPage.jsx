import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Shield, Activity, Database, 
  Zap, Menu, X, Network, Link2, 
  AlertTriangle, Users, BookOpen
} from 'lucide-react';
import PricingSection6 from './ui/pricing-section-4.jsx';
import { FocusCards } from './ui/focus-cards.jsx';

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const Navbar = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#030303]/80 backdrop-blur-md border-b border-white/5 py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <Shield className="w-8 h-8 text-teal-400" />
          <span className="text-xl font-bold tracking-tight text-white">
            Threat<span className="text-teal-400">Vision</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo('features')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</button>
          <button onClick={() => scrollTo('how-it-works')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How it Works</button>
          <button onClick={() => scrollTo('pricing')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</button>
          <button onClick={() => scrollTo('contact')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Contact</button>
          <button onClick={onGetStarted} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Login</button>
          <button onClick={onGetStarted} className="px-5 py-2 text-sm font-semibold text-[#030303] bg-teal-400 hover:bg-teal-300 rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(45,212,191,0.4)] hover:scale-105">
            Get Started
          </button>
        </div>

        <div className="md:hidden">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-300">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#0f1115] border-b border-white/10 p-4 flex flex-col gap-4 shadow-xl">
          <button onClick={() => scrollTo('features')} className="text-left font-medium py-2 text-slate-300 mt-2">Features</button>
          <button onClick={() => scrollTo('how-it-works')} className="text-left font-medium py-2 text-slate-300">How it Works</button>
          <button onClick={() => scrollTo('pricing')} className="text-left font-medium py-2 text-slate-300">Pricing</button>
          <button onClick={() => scrollTo('contact')} className="text-left font-medium py-2 text-slate-300">Contact</button>
          <button onClick={onGetStarted} className="text-left font-medium py-2 text-slate-300">Login</button>
          <button onClick={onGetStarted} className="py-3 text-center font-semibold text-[#030303] bg-teal-400 rounded-xl mb-2">Get Started</button>
        </div>
      )}
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
      src: "https://images.unsplash.com/photo-1510511459019-5efa3cae1bce?q=80&w=2070&auto=format&fit=crop",
      desc: "Detect repeated loops of funds between accounts to highlight layering schemes.",
    },
    {
      title: "Central Hub Identification",
      src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop",
      desc: "Automatically flag central hub accounts that distribute large sums into networks.",
    },
    {
      title: "Shell Entity Tracing",
      src: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop",
      desc: "Track flows through shell-style accounts used to obscure the final beneficiary.",
    },
    {
      title: "Anomaly Scoring",
      src: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?q=80&w=2070&auto=format&fit=crop",
      desc: "Score unusual payment behavior for merchants, highlighting suspicious spikes.",
    },
    {
      title: "Fee Monitoring",
      src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
      desc: "Monitor structured payments like fees to detect misuse of refund flows.",
    },
    {
      title: "Micro-Spend Signals",
      src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop",
      desc: "Enrich risk scoring using small merchants to profile and distinguish mule accounts.",
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
      <section id="contact" className="py-24 bg-[#0a0c10] border-t border-white/5 relative z-10">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
               <h2 className="text-3xl font-bold text-white mb-4">Get in touch</h2>
               <p className="text-slate-400">Have questions about deployment? Our engineers are ready to help.</p>
            </div>
            <form className="space-y-4" onSubmit={e=>e.preventDefault()}>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
                    <input type="text" className="w-full bg-[#030303] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Company</label>
                    <input type="text" className="w-full bg-[#030303] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="Acme Corp" />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Work Email</label>
                  <input type="email" className="w-full bg-[#030303] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="john@acme.com" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Message</label>
                  <textarea rows="4" className="w-full bg-[#030303] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="How can we help?" />
               </div>
               <button className="w-full py-4 bg-teal-400 hover:bg-teal-300 text-[#030303] rounded-xl font-bold text-lg transition-all hover:shadow-[0_0_15px_rgba(45,212,191,0.4)] mt-2 hover:-translate-y-0.5">Send Message</button>
            </form>
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

const Footer = () => {
   return (
     <footer className="bg-[#0a0c10] border-t border-white/5 pt-16 pb-8 relative z-10">
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
             <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-teal-400" />
                <span className="text-2xl font-bold text-white tracking-tight">Threat<span className="text-teal-400">Vision</span></span>
             </div>
             <div className="flex flex-wrap justify-center gap-8">
                <a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">Docs</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">Status</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">Security</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">Compliance</a>
                <a href="#contact" className="text-slate-400 hover:text-white transition-colors font-medium">Contact</a>
             </div>
          </div>
          <div className="text-center md:text-left border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
             <p className="text-slate-500 text-sm">© {new Date().getFullYear()} ThreatVision. All rights reserved.</p>
             <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer font-bold">X</div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer font-bold">in</div>
             </div>
          </div>
       </div>
     </footer>
   )
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
      <Footer />
    </div>
  );
}
