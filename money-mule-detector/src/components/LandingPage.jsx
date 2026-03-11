import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Shield, Activity, Database, 
  Zap, Menu, X, Network, Link2, 
  AlertTriangle, Users, BookOpen
} from 'lucide-react';

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

              <div className="flex-1 relative border border-white/5 rounded-xl bg-[#030303] overflow-hidden flex items-center justify-center">
                <Network className="w-32 h-32 text-indigo-500/20 absolute opacity-50 animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500 absolute top-1/4 left-1/3 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.4)] z-10 transition-transform duration-300 hover:scale-125">
                  <Shield className="w-4 h-4 text-rose-400" />
                </div>
                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500 absolute bottom-1/3 right-1/4 flex items-center justify-center z-10 transition-transform duration-300 hover:scale-125">
                  <Users className="w-3 h-3 text-teal-400" />
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500 absolute top-1/2 left-2/3 -translate-y-1/2 flex items-center justify-center z-10 transition-transform duration-300 hover:scale-125">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                   <line x1="33%" y1="25%" x2="66%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" className="animate-pulse" />
                   <line x1="75%" y1="66%" x2="66%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                </svg>
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
      icon: <Activity className="w-6 h-6 text-teal-400" />,
      desc: "Detect repeated loops of funds between the same group of accounts (e.g., ACC_Nathaniel_Frost, ACC_Yemi_Adeyinka, ACC_Lila_Marchetti) to highlight potential layering schemes.",
      pill: "Graph Analytics"
    },
    {
      title: "Central Hub Identification",
      icon: <Network className="w-6 h-6 text-indigo-400" />,
      desc: "Automatically flag central hub accounts like ACC_Central_Hub_Boris that receive many medium-value payments and redistribute large sums back into the network.",
      pill: "Real-time"
    },
    {
      title: "Shell Entity Tracing",
      icon: <Link2 className="w-6 h-6 text-rose-400" />,
      desc: "Track flows through shell-style accounts (e.g., ACC_Shell_Renata) used to obscure the final beneficiary (ACC_Final_Recvr_Dubois).",
      pill: "ML-Powered"
    },
    {
      title: "Merchant & Payroll Anomaly Scoring",
      icon: <Database className="w-6 h-6 text-amber-400" />,
      desc: "Score unusual payment behavior for merchants and corporates (e.g., ACC_Megastore_Corp), highlighting suspicious spikes or patterns.",
      pill: "Behavioral"
    },
    {
      title: "Education & Fee Monitoring",
      icon: <BookOpen className="w-6 h-6 text-blue-400" />,
      desc: "Monitor structured payments like ACC_University_Fees to detect misuse of tuition or refund flows used as cash-out channels.",
      pill: "Heuristics"
    },
    {
      title: "Lifestyle & Micro-Spend Signals",
      icon: <Zap className="w-6 h-6 text-green-400" />,
      desc: "Enrich risk scoring using small merchants to profile mule accounts and distinguish normal consumer behavior from fraud rings.",
      pill: "AI-Powered"
    }
  ];

  return (
    <section id="features" className="py-24 bg-[#0a0c10] border-t border-white/5 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">
            Intelligence built for <span className="text-teal-400">complex networks</span>
          </h2>
          <p className="text-slate-400 text-lg">
            Our detection engine goes beyond simple rule-based alerts, analyzing the complete topology of your financial data.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div key={idx} className="group bg-[#030303] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.04] hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(45,212,191,0.1)]">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-white/[0.05] text-slate-300 border border-white/5 group-hover:bg-teal-500/10 group-hover:text-teal-400 group-hover:border-teal-500/20 transition-colors">
                  {feature.pill}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
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



const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 bg-[#030303] relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">Simple, transparent <span className="text-teal-400">pricing</span></h2>
          <p className="text-slate-400 text-lg">Scale your fraud detection effortlessly.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 items-center">
           <div className="bg-[#0f1115] border border-white/10 rounded-2xl p-8 hover:border-teal-500/50 transition-colors">
              <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
              <p className="text-slate-400 text-sm mb-6">For small teams and startups.</p>
              <p className="text-4xl font-bold text-white mb-6">$499<span className="text-lg text-slate-500 font-normal">/mo</span></p>
              <button className="w-full py-3 mb-6 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors border border-white/10">Start Trial</button>
              <ul className="space-y-3 text-sm text-slate-300">
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Up to 100k tx/month</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Basic pattern detection</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Email support</li>
              </ul>
           </div>
           <div className="bg-gradient-to-b from-[#0f1115] to-[#0f1115] border-2 border-teal-500 rounded-2xl p-8 relative shadow-[0_0_30px_rgba(20,184,166,0.1)] md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-[#030303] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Most Popular</div>
              <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
              <p className="text-slate-400 text-sm mb-6">For growing fintechs.</p>
              <p className="text-4xl font-bold text-white mb-6">$1,299<span className="text-lg text-slate-500 font-normal">/mo</span></p>
              <button className="w-full py-3 mb-6 bg-teal-400 hover:bg-teal-300 text-[#030303] rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(45,212,191,0.4)] hover:-translate-y-1">Get Started</button>
              <ul className="space-y-3 text-sm text-slate-300">
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Up to 1M tx/month</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Advanced ML scoring</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> API Access</li>
              </ul>
           </div>
           <div className="bg-[#0f1115] border border-white/10 rounded-2xl p-8 hover:border-indigo-500/50 transition-colors">
               <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
              <p className="text-slate-400 text-sm mb-6">For large institutions.</p>
              <p className="text-4xl font-bold text-white mb-6">Custom</p>
              <button className="w-full py-3 mb-6 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors border border-white/10">Contact Sales</button>
              <ul className="space-y-3 text-sm text-slate-300">
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Unlimited volume</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> Custom models</li>
                 <li className="flex gap-2 items-center"><CheckIcon className="w-4 h-4 text-teal-400" /> 24/7 Phone SLA</li>
              </ul>
           </div>
        </div>
      </div>
    </section>
  )
}

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
      <PricingSection />
      <ContactSection />
      <CallToActionSection onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}
