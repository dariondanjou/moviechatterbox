import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — MovieChatterbox",
  description: "How MovieChatterbox collects, uses, and protects your data.",
};

// FR-12.1/12.3: accessible pre-signup; prominently discloses interest
// profiling; voice/transcript handling called out specifically.
export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Effective July 17, 2026</p>

      <p>
        MovieChatterbox (&quot;we,&quot; &quot;us&quot;) is a social audio
        platform for movie and TV lovers, operated by Team Cyan, Inc. This
        policy explains what we collect, how we use it, and the choices you
        have. It applies to the MovieChatterbox apps and website.
      </p>

      <h2 className="text-xl font-semibold pt-4">
        The headline, in plain language
      </h2>
      <p className="font-medium">
        Data you share on or generate through MovieChatterbox — your profile,
        ratings, reviews, lists, browsing and listening activity, and the
        content of live audio conversations and their transcripts — is used to
        build an individual interest profile for you. We use that profile for
        personalization, recommendations, advertising relevance, and related
        purposes. If you are not comfortable with that, please don&apos;t use
        MovieChatterbox.
      </p>

      <h2 className="text-xl font-semibold pt-4">What we collect</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Account data:</strong> email address and password (stored
          hashed by our infrastructure provider), display name, and handle.
        </li>
        <li>
          <strong>Content you create:</strong> ratings, watchlist and list
          entries, discussion posts, text chat in Chatterboxes, and feedback
          you send us (including voice notes).
        </li>
        <li>
          <strong>Live audio:</strong> when you speak in a Chatterbox, your
          audio is transmitted to other participants in real time. A
          Chatterbox is <strong>recorded only when the host turns recording
          on</strong>, and recording status is disclosed in the room while it
          is live. Recorded Chatterboxes become publicly available replays.
        </li>
        <li>
          <strong>Transcripts:</strong> live Chatterbox audio may be
          transcribed (for live captions, discussion features, and the
          profiling described above). Several jurisdictions treat voice data
          as sensitive — by speaking in a Chatterbox you consent to this
          processing.
        </li>
        <li>
          <strong>Usage signals:</strong> screens you visit, titles you view,
          Chatterboxes you join, and how long you listen.
        </li>
        <li>
          <strong>Device data:</strong> platform, OS version, and app version,
          used for diagnostics and support.
        </li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">How we use it</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>To operate the service: accounts, live audio, replays, lists.</li>
        <li>
          To build your interest profile and personalize your experience,
          recommendations, and the relevance of advertising, as described
          above.
        </li>
        <li>To keep the community safe: moderation, blocking, reports.</li>
        <li>To improve the product, including AI-assisted triage of feedback.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">Who we share it with</h2>
      <p>
        We do not sell your personal information. We share data with service
        providers who process it on our behalf: Supabase (hosting and
        database), LiveKit (live audio), Deepgram (speech-to-text), and
        Anthropic (AI processing of feedback). Payment processing, when
        offered, is handled by Stripe. Film and TV metadata comes from TMDB
        and Wikidata; this product uses the TMDB API but is not endorsed or
        certified by TMDB.
      </p>

      <h2 className="text-xl font-semibold pt-4">What is public</h2>
      <p>
        Your profile, ratings, lists, discussion posts, live Chatterbox
        participation, and replays of recorded Chatterboxes you speak in are
        public. Direct feedback you send us is private.
      </p>

      <h2 className="text-xl font-semibold pt-4">Your rights</h2>
      <p>
        You can access, correct, export, or delete your data. You can delete
        your account at any time from the profile screen in the app — this
        permanently removes your account, profile, ratings, lists, posts, and
        interest profile. For access or export requests (GDPR/CCPA and
        similar laws), contact us at the address below.
      </p>

      <h2 className="text-xl font-semibold pt-4">Retention and security</h2>
      <p>
        We keep your data while your account exists and delete it when you
        delete your account, except where law requires longer retention.
        Public replays of Chatterboxes hosted by other users may persist after
        you delete your account. Data is encrypted in transit.
      </p>

      <h2 className="text-xl font-semibold pt-4">Children</h2>
      <p>
        MovieChatterbox is not directed to children under 13 (or the
        equivalent minimum age in your jurisdiction), and we do not knowingly
        collect data from them.
      </p>

      <h2 className="text-xl font-semibold pt-4">Changes and contact</h2>
      <p>
        We will post any material changes to this policy here and update the
        effective date. Questions or requests:{" "}
        <a className="underline" href="mailto:privacy@moviechatterbox.com">
          privacy@moviechatterbox.com
        </a>
        .
      </p>
    </div>
  );
}
