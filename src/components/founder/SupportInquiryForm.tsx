"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, CheckCircle2, AlertCircle, Send } from "lucide-react";

interface FormErrors {
  subject?: string;
  category?: string;
  message?: string;
  contactEmail?: string;
}

export function SupportInquiryForm() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const errs: FormErrors = {};

    if (!subject.trim()) {
      errs.subject = "Subject is required.";
    }
    if (!contactEmail.trim()) {
      errs.contactEmail = "Contact email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errs.contactEmail = "Please enter a valid email address.";
    }
    if (!message.trim()) {
      errs.message = "Message details are required.";
    } else if (message.trim().length < 10) {
      errs.message = "Message must be at least 10 characters long.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitted(true);
    setErrors({});
    setSubject("");
    setMessage("");
    setContactEmail("");
  }

  return (
    <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
      <CardHeader className="pb-3 border-b border-[var(--card-border)]">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-[var(--accent)]" />
          <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
            Submit Support Inquiry or Incident
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-[var(--muted)]">
          Need operational assistance? Submit an expedited dispatch request directly to system support.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {submitted && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Support inquiry dispatched. Our platform operations team has been notified at cookcue149@gmail.com and will respond within 2 hours.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <label
                htmlFor="support-subject"
                className="block text-xs font-semibold text-[var(--foreground)]"
              >
                Subject <span className="text-destructive">*</span>
              </label>
              <Input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
                }}
                placeholder="Brief summary of request..."
                aria-required="true"
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? "support-subject-error" : undefined}
                className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.subject && (
                <p
                  id="support-subject-error"
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 font-medium mt-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.subject}</span>
                </p>
              )}
            </div>

            {/* Contact Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="support-email"
                className="block text-xs font-semibold text-[var(--foreground)]"
              >
                Contact Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="support-email"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  if (errors.contactEmail) setErrors((prev) => ({ ...prev, contactEmail: undefined }));
                }}
                placeholder="operator@organization.com"
                aria-required="true"
                aria-invalid={!!errors.contactEmail}
                aria-describedby={errors.contactEmail ? "support-email-error" : undefined}
                className={errors.contactEmail ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.contactEmail && (
                <p
                  id="support-email-error"
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 font-medium mt-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.contactEmail}</span>
                </p>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label
              htmlFor="support-category"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Inquiry Category
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="GENERAL">General Operational Question</option>
              <option value="DATA_ADJUSTMENT">Meal Data / Closeout Exception</option>
              <option value="KITCHEN_SETUP">Kitchen Facility Setup</option>
              <option value="URGENT_DOWNTIME">Active Meal Service Production Issue</option>
            </select>
          </div>

          {/* Message Details */}
          <div className="space-y-1.5">
            <label
              htmlFor="support-message"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Message Details <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="support-message"
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              placeholder="Describe the issue, station, or question in detail..."
              aria-required="true"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "support-message-error" : undefined}
              className={errors.message ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.message && (
              <p
                id="support-message-error"
                role="alert"
                className="text-xs text-destructive flex items-center gap-1 font-medium mt-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.message}</span>
              </p>
            )}
          </div>

          <Button type="submit" size="sm" className="gap-2 font-semibold shadow-xs">
            <Send className="w-3.5 h-3.5" />
            <span>Submit Inquiry</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
