import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MovieChatterbox",
  description: "The rules for using MovieChatterbox.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">Effective July 17, 2026</p>

      <p>
        These terms govern your use of MovieChatterbox, operated by Team Cyan,
        Inc. By creating an account or using the service you agree to them and
        to our{" "}
        <a className="underline" href="/privacy">
          Privacy Policy
        </a>
        , including the use of your activity to build an interest profile as
        described there.
      </p>

      <h2 className="text-xl font-semibold pt-4">Your account</h2>
      <p>
        You must be at least 13 years old (or the minimum age in your
        jurisdiction). You are responsible for your account and for what
        happens through it. You can delete your account at any time from the
        profile screen in the app.
      </p>

      <h2 className="text-xl font-semibold pt-4">Live audio and recordings</h2>
      <p>
        Chatterboxes are live, public audio conversations. Hosts may record a
        Chatterbox; recording status is disclosed in the room, and recorded
        Chatterboxes become publicly available replays. By speaking in a
        Chatterbox you consent to real-time transmission, and — when recording
        is on — to the recording, transcription, and public replay of your
        contributions.
      </p>

      <h2 className="text-xl font-semibold pt-4">Community conduct</h2>
      <p>
        No harassment, hate speech, threats, sexual content involving minors,
        doxxing, spam, or illegal content — in audio, text, or profile
        content. Hosts are responsible for moderating their Chatterboxes and
        may mute or remove participants. You can block users and report
        content or behavior in the app; we may suspend or terminate accounts
        that violate these rules, and we respond to reports without prior
        notice.
      </p>

      <h2 className="text-xl font-semibold pt-4">Your content</h2>
      <p>
        You own what you create. By posting or speaking on MovieChatterbox you
        grant us a worldwide, non-exclusive, royalty-free license to host,
        store, reproduce, transcribe, adapt, publish, and distribute that
        content as part of operating and promoting the service, including in
        public replays. This license ends when you delete the content or your
        account, except for public replays of Chatterboxes hosted by others
        and copies required by law.
      </p>

      <h2 className="text-xl font-semibold pt-4">Our content</h2>
      <p>
        Film and TV metadata and imagery are provided by TMDB and Wikidata.
        This product uses the TMDB API but is not endorsed or certified by
        TMDB. The MovieChatterbox name, logo, and software are ours; don&apos;t
        copy, scrape, or reverse-engineer the service.
      </p>

      <h2 className="text-xl font-semibold pt-4">Disclaimers</h2>
      <p>
        MovieChatterbox is provided &quot;as is&quot; without warranties of
        any kind. To the maximum extent permitted by law, Team Cyan, Inc. is
        not liable for indirect, incidental, special, consequential, or
        punitive damages, or for user content, and our total liability for any
        claim is limited to the greater of $100 or the amount you paid us in
        the twelve months before the claim.
      </p>

      <h2 className="text-xl font-semibold pt-4">Changes and contact</h2>
      <p>
        We may update these terms; material changes will be posted here with a
        new effective date, and continued use constitutes acceptance. These
        terms are governed by the laws of the United States and the state of
        incorporation of Team Cyan, Inc. Questions:{" "}
        <a className="underline" href="mailto:privacy@moviechatterbox.com">
          privacy@moviechatterbox.com
        </a>
        .
      </p>
    </div>
  );
}
