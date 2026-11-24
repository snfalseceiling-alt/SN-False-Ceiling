import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { AppView } from '../types';

export function PublicInfoPages({ page }: { page: AppView }) {
  const { setView, setAiDrawerOpen, showNotice } = useApp();
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });

  if (page === 'about') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <h1 className="font-display text-3xl font-bold text-[#0F2942]">About BuildMate</h1>
        <p className="text-base text-slate-600 leading-relaxed">
          BuildMate is an India-wide B2B &amp; B2C electrical and plumbing material procurement marketplace. We eliminate manual shop-to-shop price chasing by giving electricians, plumbers, contractors, builders, and homeowners one structured workspace to compile material lists, generate Indian GST PDF quotations, request competitive bids from verified local suppliers, compare offers side-by-side, and track orders to site delivery.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-display font-bold text-[#0F2942]">40 Specialized Categories</h2>
            <p className="text-xs text-slate-600 mt-1">20 electrical and 20 plumbing categories tailored for Indian construction standards.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-display font-bold text-[#0F2942]">Transparent Comparisons</h2>
            <p className="text-xs text-slate-600 mt-1">Every supplier receives the exact same requirement. Quotes remain private between shop and buyer.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-display font-bold text-[#0F2942]">Verified Regional Shops</h2>
            <p className="text-xs text-slate-600 mt-1">Suppliers specify exact service cities and PIN codes and undergo Admin verification.</p>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'how-it-works') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F2942]">How BuildMate Works</h1>
          <p className="text-sm text-slate-600 mt-2">
            From site drawing review to verified material delivery in four structured steps.
          </p>
        </div>
        <div className="space-y-4">
          {[
            {
              title: '01. Create Your Project & Material List',
              body: 'Select products from our 40 electrical and plumbing categories, enter custom manual materials not in the catalogue, or start from a reusable 2BHK/commercial template.',
            },
            {
              title: '02. Export Estimated PDF & Discover Verified Shops',
              body: 'Download an indicative GST planning PDF immediately, then filter verified suppliers by your site PIN code, city, state, and required material domain.',
            },
            {
              title: '03. Receive & Compare Supplier-Confirmed Quotations',
              body: 'Each selected supplier responds with their offered brands, stock availability, confirmed unit prices, GST, delivery charges, and lead times. Compare side-by-side or use the AI Quotation Assistant.',
            },
            {
              title: '04. Accept Full or Split Orders & Track Delivery',
              body: 'Place an order with a single shop or split line items across multiple suppliers. Track dispatch, carrier info, and payment confirmation directly from your dashboard.',
            },
          ].map((s) => (
            <div key={s.title} className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="font-display text-lg font-bold text-[#0F2942]">{s.title}</h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setView('builder')}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
        >
          Start Building Your Material List
        </button>
      </div>
    );
  }

  if (page === 'contact') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <h1 className="font-display text-3xl font-bold text-[#0F2942]">Contact BuildMate</h1>
        <p className="text-sm text-slate-600">
          Need onboarding help for your electrical or plumbing dealership, or support with an order? Send us a message.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showNotice('success', 'Thank you! Our India support desk will respond to your inquiry.');
            setContactForm({ name: '', email: '', message: '' });
          }}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <input
            type="text"
            required
            value={contactForm.name}
            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
            placeholder="Your Name *"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <input
            type="email"
            required
            value={contactForm.email}
            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
            placeholder="Email Address *"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <textarea
            rows={4}
            required
            value={contactForm.message}
            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
            placeholder="How can we help?"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2942] rounded-md cursor-pointer"
          >
            Send Message
          </button>
        </form>
      </div>
    );
  }

  if (page === 'help') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#0F2942]">Help Centre</h1>
            <p className="text-sm text-slate-600 mt-1">
              Guides for contractors, homeowners, and suppliers across India.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiDrawerOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
          >
            Open AI Support &amp; Material Assistant
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: 'Why are catalogue prices marked "Estimated"?',
              text: 'Copper, PVC resin, and sanitaryware prices vary by city, brand series, and quantity. Catalogue rates help you budget; verified supplier quotations give binding market prices.',
            },
            {
              title: 'How does Supplier Verification work?',
              text: 'Every shop submits GSTIN/MSME/License details and service PIN codes. BuildMate Super Admins review and approve shops before they can receive RFQs.',
            },
            {
              title: 'How do UPI, Bank Transfer, and Razorpay payments work?',
              text: 'Online Razorpay payments require gateway confirmation. For UPI/NEFT/RTGS transfers, submit your UTR reference so the supplier or admin can verify receipt.',
            },
            {
              title: 'Are AI quantity suggestions exact?',
              text: 'No. Any AI checklist is a planning estimate only. Always verify wire lengths, breaker ratings, and pipe diameters from approved drawings and licensed engineers.',
            },
          ].map((card) => (
            <div key={card.title} className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-display text-base font-bold text-[#0F2942]">{card.title}</h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === 'privacy') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        <h1 className="font-display text-3xl font-bold text-[#0F2942]">Privacy Policy</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          BuildMate protects customer project details, material lists, and supplier pricing confidentiality. Quotation responses submitted by one supplier are never visible to competing suppliers. Business verification documents submitted by shop owners are accessible only to authorized administrators for compliance verification in accordance with applicable Indian data protection standards.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
      <h1 className="font-display text-3xl font-bold text-[#0F2942]">Terms &amp; Conditions</h1>
      <p className="text-sm text-slate-600 leading-relaxed">
        All material estimates generated from the BuildMate reference catalogue or AI checklist assistant are indicative planning tools only. Confirmed pricing, GST rates, delivery timelines, and product warranties are governed by the respective supplier-confirmed quotation accepted at the time of order placement.
      </p>
    </div>
  );
}
