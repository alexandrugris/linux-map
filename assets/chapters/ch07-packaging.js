/* ch07 — Packages, repositories, and installing software */
(function () {
  LX.push({
    id: "packaging",
    title: "Packages, repositories, and installing software",
    tagline: "An archive plus metadata plus a graph of who needs what — and a signature chain that is the only reason to trust any of it.",
    sections: [
      {
        type: "prose",
        h: "What a package is, precisely",
        p: [
          "Strip the word 'package' down and there is nothing magical left. A Debian package is an <code>ar</code> archive holding three members in a fixed order: a four-byte version stamp, a compressed tarball of metadata, and a compressed tarball of files. There is no registry, no runtime agent, no magic. The sophistication is entirely in the second member and in the code that consumes the first two.",
          "The reason to formalise this at all is that a machine with 400 installed packages has dependencies, versions, upgrade ordering, and files owned by more than one package — and unpacking 400 tarballs by hand does not solve any of those. <code>dpkg</code> solves them badly and predictably; <code>apt</code> on top solves dependency resolution well and does nothing else; the <code>rpm</code> database on Fedora does the same job with a different schema; pacman does it with a directory of directories. All four ship the same four ideas: a database of what is installed, a way to verify files, a script hook per package, and a versioned dependency relation.",
          "What no package manager gives you is atomicity. <code>apt-get install</code> that fails halfway has already unpacked packages, already run <code>preinst</code>, and already modified files the previous version owned. There is no transaction, no rollback, and no undo — only a database that records what happened so a human (or <code>dpkg --configure -a</code>) can finish the job. Understanding that is the difference between being surprised by a broken system and recognising a half-configured state.",
          "The one thing every good package manager has in common is that it refuses to act on an unverified payload. That is not a cryptographic nicety bolted on at the end; it is the only reason a package fetched over the network is worth installing at all. We come back to it after the anatomy."
        ]
      },
      {
        type: "diagram",
        h: "Anatomy of a .deb",
        caption: "Three <code>ar</code> members, in this exact order, because <code>dpkg</code> streams them in sequence and needs to know where the metadata ends before the data begins. <code>dpkg-deb -I</code> reads only the control member; <code>dpkg-deb -c</code> reads the index of the data member; <code>dpkg-deb -x</code> extracts without any of it. All three mtimes are copied from the filesystem, which is exactly why <code>SOURCE_DATE_EPOCH</code> makes a rebuilt package byte-identical.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Debian package archive structure with debian-binary, control.tar and data.tar, and the contents of each">
  <rect class="box-a" x="40" y="24" width="1020" height="52" rx="10"/>
  <text class="t-accent" x="60" y="50" font-size="16">nginx_1.14.0-2ubuntu3.5_amd64.deb  —  an ar(1) archive, 316 kB</text>
  <text class="t-xs" x="60" y="68">ar headers carry the same zeroed uid/gid/mtime as the machine that built it; that is what SOURCE_DATE_EPOCH normalises</text>

  <path class="ln-a" d="M180,76 L180,104" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M420,76 L420,104" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M700,76 L700,104" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box" x="80" y="108" width="200" height="76" rx="9"/>
  <text class="t-sm" x="180" y="134" font-size="15" text-anchor="middle">debian-binary</text>
  <text class="t-xs" x="180" y="156" text-anchor="middle">4 bytes: "2.0\\n"</text>
  <text class="t-xs" x="180" y="176" text-anchor="middle">the archive format version.</text>
  <text class="t-xs" x="180" y="192" text-size="12" text-anchor="middle">dpkg refuses anything it does not know</text>

  <rect class="box-v" x="320" y="108" width="200" height="76" rx="9"/>
  <text class="t-sm" x="420" y="134" font-size="15" text-anchor="middle">control.tar.gz</text>
  <text class="t-xs" x="420" y="156" text-anchor="middle">the metadata — how dpkg</text>
  <text class="t-xs" x="420" y="174" text-anchor="middle">decides what to do</text>
  <text class="t-xs" x="420" y="192" text-anchor="middle">xz on modern Ubuntu</text>

  <rect class="box-ok" x="600" y="108" width="200" height="76" rx="9"/>
  <text class="t-sm" x="700" y="134" font-size="15" text-anchor="middle">data.tar.xz</text>
  <text class="t-xs" x="700" y="156" text-anchor="middle">the files, with their</text>
  <text class="t-xs" x="700" y="174" text-anchor="middle">uid/gid/mode recorded</text>
  <text class="t-xs" x="700" y="192" text-anchor="middle">this is the payload</text>

  <path class="ln-v" d="M420,184 L420,214" marker-end="url(#lm-arrow)"/>
  <path class="ln-ok" d="M700,184 L700,214" marker-end="url(#lm-arrow-ok)"/>

  <!-- control contents -->
  <rect class="box-v" x="240" y="218" width="360" height="222" rx="11"/>
  <text class="t-violet" x="258" y="244" font-size="15">inside control.tar</text>
  <text class="t-xs" x="258" y="268">./control       Package, Version, Architecture, Depends,</text>
  <text class="t-xs" x="258" y="286">                Description, Installed-Size, Multi-Arch</text>
  <text class="t-xs" x="258" y="308">./md5sums       per-file MD5s, used by dpkg -V</text>
  <text class="t-xs" x="258" y="326">./conffiles     paths dpkg will never silently overwrite</text>
  <text class="t-xs" x="258" y="348">./preinst       before unpack        ./prerm     before remove</text>
  <text class="t-xs" x="258" y="366">./postinst      after unpack         ./postrm    after remove</text>
  <text class="t-xs" x="258" y="388">./triggers      fires on other packages' events</text>
  <text class="t-xs" x="258" y="406">./shlibs        symbol needs, consumed by dpkg-shlibdeps</text>
  <text class="t-xs" x="258" y="428" font-size="14" font-weight="600">one bad script and the package is un-unpackable</text>

  <!-- data contents -->
  <rect class="box-ok" x="620" y="218" width="420" height="222" rx="11"/>
  <text class="t-ok" x="638" y="244" font-size="15">inside data.tar, for this package</text>
  <text class="t-xs" x="638" y="272">./usr/sbin/nginx          the daemon, mode 0755, root:root</text>
  <text class="t-xs" x="638" y="294">./usr/lib/nginx/modules/*.so</text>
  <text class="t-xs" x="638" y="316">./etc/nginx/nginx.conf    listed in ./conffiles</text>
  <text class="t-xs" x="638" y="338">./lib/systemd/system/nginx.service</text>
  <text class="t-xs" x="638" y="360">./usr/share/man/man8/nginx.8.gz</text>
  <text class="t-xs" x="638" y="382">./usr/share/doc/nginx/copyright</text>
  <text class="t-xs" x="638" y="408" font-size="14" font-weight="600">every path is recorded in /var/lib/dpkg/info/nginx.list</text>
  <text class="t-xs" x="638" y="428">so dpkg knows which files to remove and can reverse a lookup</text>

  <rect class="box" x="40" y="470" width="1020" height="146" rx="10"/>
  <text class="t-sm" x="60" y="496" font-size="15">the three read commands, and what each one costs</text>
  <text class="t-xs" x="60" y="520">dpkg-deb -I pkg.deb   —  reads member 1 then 2 only. No decompression of data.tar. Use this on anything untrusted.</text>
  <text class="t-xs" x="60" y="542">dpkg-deb -c pkg.deb   —  lists data.tar's index. Still decompresses the whole stream, because there is no index.</text>
  <text class="t-xs" x="60" y="564">dpkg-deb -x pkg.deb d —  writes files to d/. This is why you never untar a package straight into /</text>
  <text class="t-xs" x="60" y="586">apt-get source nginx  —  fetches orig tarball plus a debian.diff.gz from the deb-src lines; the -2ubuntu3.5 revision is what is Debian-side</text>
</svg>
`
      },
      {
        type: "table",
        cols: ["Control field", "What it means", "How the resolver treats it"],
        rows: [
          ["<code>Package</code> / <code>Source</code>", "Binary name / the source package it was built from", "Many binary packages share one source. <code>nginx</code> and <code>nginx-core</code> are two binaries from one source on 18.04."],
          ["<code>Version</code>", "<code>[epoch:]upstream[-debian_revision]</code>", "The epoch lets a Debian revision overtake an upstream version that went <em>backwards</em>. Without it, <code>0:1.0</code> could never beat <code>1:0.9</code>-style rescues."],
          ["<code>Architecture</code>", "<code>amd64</code>, <code>all</code>, <code>i386</code>", "<code>all</code> means one file shared by every architecture; <code>Multi-Arch: same</code> lets it be installed twice in parallel."],
          ["<code>Depends</code>", "Hard requirement", "Unsatisfied <code>Depends</code> means the package cannot be configured. This is the relation that produces <code>half-configured</code>."],
          ["<code>Recommends</code>", "Wanted, defaults to installed", "Installed unless <code>--no-install-recommends</code> or <code>APT::Install-Recommends</code> is set. This is where a lot of 'why did it pull in so much' disk goes."],
          ["<code>Suggests</code> / <code>Enhances</code>", "Nice to have", "Never installed automatically by <code>apt-get install</code>; <code>apt install</code> mentions them."],
          ["<code>Conflicts</code>", "Cannot be co-installed", "Hard refusal at resolve time. Two different packages shipping the same path is the classic case."],
          ["<code>Breaks</code>", "Cannot be co-installed, even at a different version", "Same effect, different intent: upgrade of one forces removal of the other, which is how a libc upgrade cascades."],
          ["<code>Replaces</code> / <code>Provides</code>", "Fills a path another package owned / satisfies a virtual name", "Lets two packages swap files across an upgrade without a <code>Conflicts</code> war."],
          ["<code>Installed-Size</code>", "kibibytes, for the resolver's arithmetic", "Vaguely wrong on compressed filesystems, which is why apt's disk-usage estimates are optimistic."],
          ["<code>Description</code>", "The short synopsis plus extended multi-paragraph body", "Rendered by <code>apt show</code>. If it is empty, the package was built with a broken Lintian run."]
        ]
      },
      {
        type: "prose",
        h: "dpkg: the database and the state machine",
        p: [
          "dpkg keeps its entire state in one text file, <code>/var/lib/dpkg/status</code>, in the RFC822-ish stanza format you already know from <code>/etc/passwd</code>. One stanza per installed package, with a <code>Status:</code> field encoding the state and a <code>Status</code>-level line listing which files came from the package. Alongside it sit <code>/var/lib/dpkg/info/&lt;pkg&gt;.list</code> (every file the package owns), <code>&lt;pkg&gt;.md5sums</code>, <code>&lt;pkg&gt;.conffiles</code>, <code>&lt;pkg&gt;.postinst</code> and friends, <code>/var/lib/dpkg/available</code>, the <code>updates/</code> staging directory for unpacked-but-unconfigured packages, and <code>/var/lib/dpkg/lock</code> (the <code>flock</code> that stops two dpkg processes racing).",
          "Because the database is plain text and the scripts are plain files, you can read dpkg's mind without dpkg. <code>grep -A2 '^Package: nginx$' /var/lib/dpkg/status</code> tells you whether it is installed, half-configured, or only unpacked. That single fact makes most 'my package manager is stuck' problems legible in seconds.",
          "The state machine is the part worth knowing properly, because the error messages reference it. The states are: <code>not-installed</code>, <code>config-files</code> (files removed but conffiles kept, i.e. after <code>dpkg --remove</code>), <code>unpacked</code> (files on disk, not yet configured), <code>half-configured</code> (the postinst failed), <code>triggers-awaited</code>, <code>triggers-pending</code>, <code>installed</code> (<code>ok installed</code>, the only fully healthy state), <code>half-installed</code> (unpack failed, so files may be partially written), and <code>not-halved-installed</code>. A <code>hold</code> is not a state; it is a flag that makes the resolver refuse to move the package.",
          "Every transition runs scripts, and the scripts are where everything goes wrong. <code>preinst</code> runs before the new files are unpacked, <code>postinst</code> after. <code>prerm</code> and <code>postrm</code> bracket removal, and all four receive <code>$1</code> as <code>install</code>, <code>upgrade</code>, <code>remove</code>, <code>deconfigure</code>, <code>failed-upgrade</code> or <code>abort-upgrade</code>, with <code>$2</code> the version being replaced. The <code>upgrade</code> argument is what makes removal different from upgrade: a script that only implements <code>remove</code> and not <code>upgrade</code> will delete data on an upgrade and file a bug that takes a maintainer a year to find.",
          "<strong>conffiles</strong> is the mechanism that keeps upgrades from eating your configuration. If a file is listed in <code>conffiles</code> and you have edited it, dpkg does not overwrite it and does not ask when non-interactive; it installs the maintainer's version alongside as <code>foo.dpkg-new</code>, keeps your <code>foo</code>, and the postinst usually merges or complains. The cost is that a machine which has been hand-edited for two years drifts from the packaged file, and at some point the postinst's merge logic simply gives up. On a box where nginx config has been hand-edited across four point releases, <code>*.dpkg-new</code> files are evidence, not noise."
        ]
      },
      {
        type: "diagram",
        h: "The dpkg state machine, and the two commands that get you out of it",
        caption: "dpkg does one transition at a time and records each one in <code>/var/lib/dpkg/status</code>. A failure leaves you in <code>half-configured</code> or <code>half-installed</code>, and both are recoverable because the files are already on disk — the transition just has to be re-attempted. <code>dpkg --configure -a</code> retries every half-configured package in dependency order; <code>dpkg --audit</code> prints the ones that need attention without doing anything.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="dpkg package state transitions from not-installed through unpacked and half-configured to installed, and the recovery commands">
  <rect class="box" x="40" y="24" width="190" height="72" rx="9"/>
  <text class="t-sm" x="135" y="52" font-size="15" text-anchor="middle">not-installed</text>
  <text class="t-xs" x="135" y="74" text-anchor="middle">no files, no stanza,</text>
  <text class="t-xs" x="135" y="90" text-anchor="middle">maybe an empty one</text>

  <path class="ln-a" d="M230,52 L296,52" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="263" y="42" font-size="13" text-anchor="middle">dpkg -i</text>

  <rect class="box-v" x="300" y="24" width="190" height="72" rx="9"/>
  <text class="t-sm" x="395" y="52" font-size="15" text-anchor="middle">unpacked</text>
  <text class="t-xs" x="395" y="74" text-anchor="middle">files are on disk,</text>
  <text class="t-xs" x="395" y="90" text-anchor="middle">metadata written</text>

  <path class="ln-a" d="M490,52 L556,52" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="523" y="42" font-size="13" text-anchor="middle">configure</text>

  <rect class="box-b" x="560" y="24" width="230" height="72" rx="9"/>
  <text class="t-sm" x="675" y="52" font-size="15" text-anchor="middle">half-configured</text>
  <text class="t-xs" x="675" y="74" text-anchor="middle">postinst exited non-zero</text>
  <text class="t-xs" x="675" y="90" text-anchor="middle">DEPENDS unsatisfiable</text>

  <path class="ln-b" d="M790,52 L856,52" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="823" y="42" font-size="13" text-anchor="middle">retry</text>

  <rect class="box-ok" x="860" y="24" width="200" height="72" rx="9"/>
  <text class="t-sm" x="960" y="52" font-size="15" text-anchor="middle">ok installed</text>
  <text class="t-xs" x="960" y="74" text-anchor="middle">the only state apt</text>
  <text class="t-xs" x="960" y="90" text-anchor="middle">considers finished</text>

  <path class="ln" d="M960,96 L960,124" marker-end="url(#lm-arrow)"/>
  <rect class="box" x="860" y="128" width="200" height="64" rx="9"/>
  <text class="t-sm" x="960" y="154" font-size="14" text-anchor="middle">triggers-pending</text>
  <text class="t-xs" x="960" y="176" text-anchor="middle">another package wants a hook fired</text>

  <path class="ln" d="M523,96 L523,124" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="300" y="128" width="230" height="64" rx="9"/>
  <text class="t-sm" x="415" y="154" font-size="14" text-anchor="middle">half-installed</text>
  <text class="t-xs" x="415" y="176" text-anchor="middle">unpack failed: ENOSPC, or a file vanished</text>

  <path class="ln" d="M480,160 L300,160" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="390" y="182" font-size="12" text-anchor="middle">remove files, keep database</text>

  <path class="ln" d="M960,192 L960,232" marker-end="url(#lm-arrow)"/>
  <rect class="box-w" x="860" y="236" width="200" height="72" rx="9"/>
  <text class="t-sm" x="960" y="262" font-size="15" text-anchor="middle">config-files</text>
  <text class="t-xs" x="960" y="284" text-anchor="middle">after --remove: conffiles</text>
  <text class="t-xs" x="960" y="300" text-anchor="middle">survive on purpose</text>

  <path class="ln" d="M860,272 L800,272" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="830" y="262" font-size="12" text-anchor="middle">purge</text>

  <!-- hold -->
  <rect class="box-p" x="40" y="232" width="230" height="76" rx="9"/>
  <text class="t-sm" x="58" y="258" font-size="14">hold — a flag, not a state</text>
  <text class="t-xs" x="58" y="280">apt-mark hold pkg   →  refused upgrades</text>
  <text class="t-xs" x="58" y="298">and refuses removal. It does NOT stop</text>
  <text class="t-xs" x="58" y="316">a dependency from moving underneath it.</text>

  <path class="ln-p" d="M270,270 L330,270" stroke-dasharray="6 5"/>
  <text class="t-dim" x="300" y="336" font-size="12" text-anchor="middle">cuts the upgrade edge</text>

  <rect class="box" x="40" y="356" width="1020" height="146" rx="10"/>
  <text class="t-sm" x="60" y="382" font-size="15">how to see where you are, without trusting any tool that hides it</text>
  <text class="t-xs" x="60" y="406">grep -E '^(Package|Status):' /var/lib/dpkg/status | grep -B1 -v 'ok installed' | head -40</text>
  <text class="t-xs" x="60" y="428">dpkg --audit                —  prints every package not in a good state, changes nothing</text>
  <text class="t-xs" x="60" y="450">dpkg --configure -a         —  re-runs postinst for every half-configured package, in dependency order</text>
  <text class="t-xs" x="60" y="472">dpkg --configure &lt;pkg&gt;      —  re-runs just that one. dpkg -l 'nginx*'  |  grep ^i  —  the fourth column is the state letter</text>
  <text class="t-xs" x="60" y="492">iU = unpacked/unconfigured · iF = half-configured · iHR = half-installed, reinst-required · rc = removed, config remains</text>

  <rect class="box-b" x="40" y="524" width="1020" height="96" rx="10"/>
  <text class="t-bad" x="60" y="550" font-size="15">the state you should never build tooling on</text>
  <text class="t-xs" x="60" y="574">if a postinst needs something from a package that has not been unpacked yet, the machine is now permanently half-configured and</text>
  <text class="t-xs" x="60" y="596">no amount of re-running dpkg will fix it. This is what Depends ordering exists to prevent, and it is why a hand-rolled</text>
  <text class="t-xs" x="60" y="614">dpkg -i on a .deb whose dependencies are not already installed is a trap, not a shortcut.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "Why <code>apt install</code> is really two programs",
        p: [
          "<code>apt-get install foo</code> does three distinct jobs and the split explains most of the behaviour people find confusing. It <strong>resolves</strong> — computes a set of packages and versions that satisfies every <code>Depends</code> using its own SAT-style solver and the versioned relations from the indexes. It <strong>acquires</strong> — downloads the <code>.deb</code> files into <code>/var/cache/apt/archives/</code> after verifying each one's SHA256 against the signed index. It <strong>installs</strong> — hands them to <code>dpkg</code>, which is the only component that ever touches the filesystem.",
          "apt never modifies the filesystem. It invokes <code>dpkg</code>, which runs the maintainer scripts. This is why the two failure modes look different: a resolver failure prints <code>E: Unable to correct problems, you have held broken packages.</code> and changes nothing at all, while a dpkg failure prints script output and leaves a half-configured package behind.",
          "It is also why <code>dpkg -i</code> on a dependency-ful package is a known footgun. dpkg does not resolve anything. <code>dpkg -i git.deb</code> on a machine without <code>libcurl</code> unpacks it, runs <code>preinst</code>, runs <code>postinst</code>, gets <code>Depends: libcurl4, libc6</code> unsatisfied and leaves <code>iU</code>. The recovery is <code>apt-get -f install</code>, which means 'go and let apt solve the graph I just broke'.",
          "What apt's solver actually optimises: it picks a candidate version per package from the available versions, ordered by pin priority then by version, and satisfies every relation. It does not know about ABI. It does not know that <code>libfoo.so.1</code> and <code>libfoo.so.2</code> are binary-incompatible. It does not know that a <code>postinst</code> will fail. Its only notion of ordering is version numbers and the declared relations, which is precisely why a repository that ships an inconsistent set cannot be diagnosed by the tool that is choking on it."
        ]
      },
      {
        type: "diagram",
        h: "The whole pipeline, from a line in sources.list to a running service",
        caption: "Read this left to right and you never have to guess where a failure came from. The stages are separate processes with separate caches: a wrong URL fails in stage 1 with an <code>Err:</code> line, a bad key fails in stage 2 before a single byte of the package is used, a hash mismatch fails in stage 5, and a bad postinst fails in stage 7 with a half-configured package left behind. Each stage's cache is inspectable on its own.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="apt install pipeline from sources.list through index download, GPG verification, dependency resolution, package download and hash check, dpkg unpack and configure, to triggers">
  <!-- sources -->
  <rect class="box" x="40" y="24" width="230" height="96" rx="10"/>
  <text class="t-sm" x="58" y="48" font-size="14">/etc/apt/sources.list</text>
  <text class="t-xs" x="58" y="70">deb http://archive.ubuntu.com/</text>
  <text class="t-xs" x="58" y="86">    ubuntu bionic main</text>
  <text class="t-xs" x="58" y="104">+ /etc/apt/sources.list.d/*.list</text>
  <text class="t-xs" x="58" y="116">+ *.sources  (deb822, apt 1.1+)</text>

  <path class="ln-a" d="M270,72 L318,72" marker-end="url(#lm-arrow-accent)"/>

  <!-- stage 1 -->
  <rect class="box-a" x="322" y="24" width="210" height="96" rx="10"/>
  <text class="t-accent" x="340" y="48" font-size="14">1 · fetch indexes</text>
  <text class="t-xs" x="340" y="70">InRelease, Release.gpg</text>
  <text class="t-xs" x="340" y="86">main/binary-amd64/</text>
  <text class="t-xs" x="340" y="102">  Packages.gz</text>
  <text class="t-xs" x="340" y="116">apt-get update</text>

  <path class="ln-a" d="M532,72 L580,72" marker-end="url(#lm-arrow-accent)"/>

  <!-- stage 2 -->
  <rect class="box-v" x="584" y="24" width="220" height="96" rx="10"/>
  <text class="t-violet" x="602" y="48" font-size="14">2 · verify signature</text>
  <text class="t-xs" x="602" y="70">gpgv against a keyring</text>
  <text class="t-xs" x="602" y="86">/etc/apt/trusted.gpg.d/</text>
  <text class="t-xs" x="602" y="104">nothing is believed yet;</text>
  <text class="t-xs" x="602" y="118">this is the trust root</text>

  <path class="ln-a" d="M804,72 L852,72" marker-end="url(#lm-arrow-accent)"/>

  <!-- stage 3 -->
  <rect class="box-ok" x="856" y="24" width="204" height="96" rx="10"/>
  <text class="t-ok" x="874" y="48" font-size="14">3 · parse indexes</text>
  <text class="t-xs" x="874" y="70">/var/lib/apt/lists/</text>
  <text class="t-xs" x="874" y="86">~4 MB of text:</text>
  <text class="t-xs" x="874" y="102">every version, every</text>
  <text class="t-xs" x="874" y="118">Depends, for the suite</text>

  <path class="ln" d="M958,120 L958,146" stroke-dasharray="6 5"/>
  <text class="t-dim" x="976" y="140" font-size="13">stages 1–3 only happen on apt-get update, or by apt</text>

  <!-- stage 4 -->
  <rect class="box-a" x="40" y="176" width="210" height="96" rx="10"/>
  <text class="t-accent" x="58" y="200" font-size="14">4 · resolve</text>
  <text class="t-xs" x="58" y="222">read installed set from</text>
  <text class="t-xs" x="58" y="238">/var/lib/dpkg/status</text>
  <text class="t-xs" x="58" y="256">apply pins, then search</text>
  <text class="t-xs" x="58" y="268">for a satisfying set</text>

  <path class="ln-a" d="M250,224 L298,224" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="302" y="176" width="210" height="96" rx="10"/>
  <text class="t-violet" x="320" y="200" font-size="14">5 · download</text>
  <text class="t-xs" x="320" y="222">SHA256 from Packages</text>
  <text class="t-xs" x="320" y="238">vs SHA256 of the file</text>
  <text class="t-xs" x="320" y="256">/var/cache/apt/archives/</text>
  <text class="t-xs" x="320" y="268">hashed .debs, reusable</text>

  <path class="ln-a" d="M512,224 L560,224" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box" x="564" y="176" width="200" height="96" rx="10"/>
  <text class="t-sm" x="582" y="200" font-size="14">6 · dpkg -i</text>
  <text class="t-xs" x="582" y="222">unpack, in dependency</text>
  <text class="t-xs" x="582" y="238">order, into /</text>
  <text class="t-xs" x="582" y="256">runs preinst</text>
  <text class="t-xs" x="582" y="268">state → unpacked</text>

  <path class="ln-a" d="M764,224 L812,224" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="816" y="176" width="244" height="96" rx="10"/>
  <text class="t-ok" x="834" y="200" font-size="14">7 · configure</text>
  <text class="t-xs" x="834" y="222">postinst with $1=configure</text>
  <text class="t-xs" x="834" y="238">update-alternatives, ldconfig,</text>
  <text class="t-xs" x="834" y="254">systemctl preset/enable</text>
  <text class="t-xs" x="834" y="268">state → ok installed</text>

  <path class="ln-ok" d="M938,272 L938,300" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-w" x="816" y="304" width="244" height="86" rx="10"/>
  <text class="t-warn" x="834" y="328" font-size="14">8 · triggers</text>
  <text class="t-xs" x="834" y="350">ldconfig, man-db, update-initramfs</text>
  <text class="t-xs" x="834" y="368">deb-systemd-helper fires the</text>
  <text class="t-xs" x="834" y="384">enable symlinks in /etc/systemd/system</text>

  <!-- apt vs dpkg boundary -->
  <line class="ln-w dash" x1="540" y1="290" x2="540" y2="410" stroke-width="2"/>
  <rect class="box-p" x="330" y="304" width="200" height="96" rx="10"/>
  <text class="t-sm" x="348" y="330" font-size="14">the seam</text>
  <text class="t-xs" x="348" y="352">left of the line: apt</text>
  <text class="t-xs" x="348" y="368">right of the line: dpkg</text>
  <text class="t-xs" x="348" y="390">apt never writes to /; dpkg</text>
  <text class="t-xs" x="348" y="406">never resolves anything</text>

  <!-- failure modes -->
  <rect class="box-b" x="40" y="416" width="500" height="180" rx="10"/>
  <text class="t-bad" x="58" y="442" font-size="15">where each class of failure shows up</text>
  <text class="t-xs" x="58" y="466">1  wrong URL / DNS        →  W: Failed to fetch ... 404, or Err: Temporary failure resolving</text>
  <text class="t-xs" x="58" y="488">2  missing/expired key    →  NO_PUBKEY 46432EBA6C3A0FA4  /  EXPKEYSIG  →  'repository is not signed'</text>
  <text class="t-xs" x="58" y="510">3  index for wrong suite  →  'Conflicting distribution' / 'Release file expired'</text>
  <text class="t-xs" x="58" y="532">4  unsatisfiable graph    →  'has unmet dependencies' / 'held broken packages'; nothing installed</text>
  <text class="t-xs" x="58" y="554">5  corrupt download       →  'Hash Sum mismatch' → file deleted, nothing installed</text>
  <text class="t-xs" x="58" y="576">6  no space, no permission→  'unable to install new version ... input/output error' → half-installed</text>
  <text class="t-xs" x="58" y="594">7  bad postinst          →  script output, package left at iF → dpkg --configure -a</text>

  <rect class="box-a" x="560" y="416" width="500" height="180" rx="10"/>
  <text class="t-accent" x="578" y="442" font-size="15">what each stage leaves behind</text>
  <text class="t-xs" x="578" y="466">/var/lib/apt/lists/          index cache — delete it and it is refetched</text>
  <text class="t-xs" x="578" y="488">/var/cache/apt/archives/    .debs, kept by default so a retry needs no network</text>
  <text class="t-xs" x="578" y="510">/var/lib/dpkg/status        the only source of truth for what is installed</text>
  <text class="t-xs" x="578" y="532">/var/lib/dpkg/info/*.list   which files belong to whom — the reverse index</text>
  <text class="t-xs" x="578" y="554">/var/backups/*.dpkg.*       pre-upgrade copies of conffiles and binaries, kept 5 days</text>
  <text class="t-xs" x="578" y="576">/var/cache/debconf/         the questions your postinst asked and nobody answered</text>
  <text class="t-xs" x="578" y="594">On a 19 GB disk, that last one is why apt-get clean exists.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "Answer the questions you actually have about an installed package, without guessing",
        code: `# which version is installed, and what else is available?
$ dpkg -l nginx | tail -1
ii  nginx  1.14.0-2ubuntu3.5  amd64  nginx web server
#   ^^ i = installed, i = second i means ok installed, so "ii" is the only fully good state

$ apt-cache policy nginx
nginx:
  Installed: 1.14.0-2ubuntu3.5
  Candidate: 1.14.0-2ubuntu3.5
  Version table:
     1.14.0-2ubuntu3.5 500
        500 http://archive.ubuntu.com/ubuntu bionic/main amd64 Packages
        100 /var/lib/dpkg/status
#   500 is the pin priority. "100 /var/lib/dpkg/status" is the installed copy; apt will
#   never pick a lower-priority version over it, which is how holds work.

# what files does this own?
$ dpkg -L nginx | head
/etc/init.d/nginx
/etc/nginx/...
#   dpkg -L lists what it CLAIMS to own. If a file is missing it still shows up.

# who owns this file?  (the question that always gets asked)
$ dpkg -S /usr/sbin/nginx
nginx: /usr/sbin/nginx
#   dpkg -S searches /var/lib/dpkg/info/*.list — not the filesystem. A file with no
#   answer was written by hand, or by a package that was removed without --purge.

# has anything been modified since install?
$ dpkg -V nginx
??5??????   /etc/nginx/sites-available/default
#   V = verify: '?' = unmodified, '5' = MD5 differs, 'M' = mode, 'L' = symlink target,
#   'S' = size. For an /etc file that you deliberately edited, this is expected.
#   debsums (debian-goodies) does the same for /usr, where it is not.

# what does this package actually depend on, expanded?
$ apt-cache depends nginx | head -8
nginx
  Depends: nginx-core (= 1.14.0-2ubuntu3.5)
  Depends: nginx-common (= 1.14.0-2ubuntu3.5)
  Suggests: sysstat
#   Depends with '=' is an exact pin: nginx-core and nginx-common are built together.
#   This is why they upgrade as a unit and why a partial upgrade breaks nginx.

# trace a single dependency edge
$ apt-cache rdepends --installed libc6 | head -5

# what pulled this in, and is it still needed?
$ apt-mark showmanual                       # explicitly requested
$ apt-get autoremove --dry-run              # installed only as a dependency, now unused
$ apt-mark showauto                         # installed only as a dependency

# fetch a package without installing it
$ apt-get download nginx-core
$ dpkg-deb -I nginx-core_*.deb | head -20
$ dpkg-deb -x nginx-core_*.deb /tmp/inspect   # safe extraction, never into /`
      },
      {
        type: "prose",
        h: "Sources, suites, components, and what the words in a sources.list line mean",
        p: [
          "A one-line source has four fields and each one constrains something: <code>deb</code> (binary packages; <code>deb-src</code> for sources), the <strong>URI</strong>, the <strong>distribution</strong> (a suite or codename, not a URL path — <code>bionic</code> and <code>bionic-updates</code> and <code>bionic-security</code> are three separate archives), and one or more <strong>components</strong> (<code>main</code>, <code>universe</code>, <code>restricted</code>, <code>multiverse</code> on Ubuntu; <code>main</code>, <code>contrib</code>, <code>non-free</code> on Debian).",
          "<code>main</code> means free software that the distribution ships and supports. <code>universe</code> is free but community-maintained, not a priority target for security updates. <code>restricted</code> is proprietary drivers and firmware, licensed to be redistributed. <code>multiverse</code> is packages whose licence forces them out of the first three. This matters for availability of a <code>-dev</code> package and for whether a CVE gets a patch at all: a <code>universe</code> package may not get one.",
          "<strong>Suite versus codename.</strong> <code>bionic</code> is a codename that always means 18.04. <code>bionic-updates</code> and <code>bionic-security</code> are point-release and security archives for the same suite. You can also write <code>ubuntu bionic-backports main</code>, where <code>bionic-backports</code> is a separate archive of packages built against the suite but deliberately not installed by default. The release upgrader rewrites the codename in every line — that is why <code>/etc/apt/sources.list</code> has a <code>distribution</code> field you can inspect with <code>grep -R ubuntu /etc/apt/</code> after a failed upgrade.",
          "Since apt 1.1 — which Ubuntu 18.04 has — you may use <strong>deb822</strong> format in <code>/etc/apt/sources.list.d/*.sources</code> instead, which puts the fields on named lines and, crucially, lets the stanza carry its own <code>Signed-By:</code>. A per-file <code>Signed-By</code> is the correct way to trust a third-party repository in 2020, and <code>[trusted=yes]</code> is the way to not have any trust at all."
        ]
      },
      {
        type: "code",
        lang: "conf",
        what: "A sources.list that will survive an unattended security update, and a third-party repo added correctly",
        code: `# /etc/apt/sources.list — the defaults on Ubuntu 18.04, expanded
deb http://archive.ubuntu.com/ubuntu/ bionic main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ bionic-updates main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ bionic-security main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu bionic-security main restricted universe multiverse

# a third-party repository, added the right way (deb822, apt 1.1+).
# Signed-By pins the exact keyring for THIS file and nothing else.
# /etc/apt/sources.list.d/docker.list  (classic form, also fine with signed-by=)
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: bionic
Components: stable
Architectures: amd64
Signed-By: /usr/share/keyrings/docker-archive-keyring.gpg

# install the key by hand rather than trusting whatever apt-key currently holds
$ install -m 0755 -d /etc/apt/keyrings
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
$ chmod 0644 /etc/apt/keyrings/docker.gpg
#   gpg --dearmor turns the ASCII-armoured key into the binary keyring gpgv expects.

$ apt-get update
$ apt-cache policy docker-ce

# what the four things in the pipeline need, side by side:
#   keyring     /etc/apt/keyrings/*.gpg          the trust root — a public key, nothing else
#   repository  URIs: Suites: Components:          where and what
#   suite       bionic vs xenial                  which generation of packages; a mismatch is
#                                                "Conflicting distribution: ... (expected xenial but got bionic)"
#   component   main vs universe                 whether the package is eligible to be installed at all`
      },
      {
        type: "diagram",
        h: "The chain of trust, and exactly what each link proves",
        caption: "The key in the keyring is the only thing apt takes on faith, and it is only ever used to verify the <code>InRelease</code> file. Everything downstream is arithmetic: a SHA256 in a file that has already been verified. This is why a stolen mirror, a hostile CDN node, or a MITM on the network path can all be defeated by one 4096-bit RSA signature — and why losing the private key, or failing to pin the right one, is a real outage rather than a theoretical one.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Signature verification chain from publisher key through InRelease and Packages index to the downloaded package">
  <rect class="box-v" x="40" y="24" width="230" height="86" rx="10"/>
  <text class="t-sm" x="58" y="50" font-size="14">the trust root</text>
  <text class="t-xs" x="58" y="72">/etc/apt/keyrings/*.gpg</text>
  <text class="t-xs" x="58" y="90">a PUBLIC key. Anyone can have it.</text>
  <text class="t-xs" x="58" y="106">It proves who signed. Not that it is good.</text>

  <path class="ln-a" d="M270,60 L330,60" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="300" y="50" font-size="12" text-anchor="middle">gpgv</text>

  <rect class="box-a" x="334" y="24" width="250" height="86" rx="10"/>
  <text class="t-sm" x="352" y="50" font-size="14">InRelease  (link 1)</text>
  <text class="t-xs" x="352" y="72">inline clear-signed</text>
  <text class="t-xs" x="352" y="90">signature over the Release body,</text>
  <text class="t-xs" x="352" y="106">in the same file</text>

  <rect class="box-a" x="614" y="24" width="250" height="86" rx="10"/>
  <text class="t-sm" x="632" y="50" font-size="14">Release + Release.gpg</text>
  <text class="t-xs" x="632" y="72">detached signature</text>
  <text class="t-xs" x="632" y="90">the fallback for very old clients.</text>
  <text class="t-xs" x="632" y="106">Same trust, two files on the wire.</text>

  <path class="ln-v" d="M459,110 L459,146" marker-end="url(#lm-arrow)"/>
  <path class="ln-v" d="M739,110 L739,146" marker-end="url(#lm-arrow)"/>

  <rect class="box-v" x="334" y="150" width="530" height="96" rx="10"/>
  <text class="t-sm" x="352" y="176" font-size="14">inside the Release body — the index digests</text>
  <text class="t-xs" x="352" y="200">SHA256:
 843a2…  1024 main/binary-amd64/Packages.gz
 SHA256:
 4d19c…  1024 main/binary-i386/Packages.gz
 SHA256:
 c81be…   345 main/binary-amd64/Release</text>
  <text class="t-xs" x="352" y="238">plus Date, Suite, Codename, Architectures, Components — the suite/codename mismatch check uses this</text>

  <path class="ln-a" d="M520,246 L520,284" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="560" y="272" font-size="13">link 2: compare the downloaded index against the signed digest</text>

  <rect class="box-ok" x="334" y="288" width="530" height="112" rx="10"/>
  <text class="t-sm" x="352" y="314" font-size="14">main/binary-amd64/Packages — now trusted content</text>
  <text class="t-xs" x="352" y="338">Package: nginx-core
 Version: 1.14.0-2ubuntu3.5
 Depends: libc6 (&gt;= 2.27), libpcre3, zlib1g
 Filename: pool/main/n/nginx/nginx-core_1.14.0-2ubuntu3.5_amd64.deb
 Size: 524288
 SHA256: 7f3c1e9a0b2d…      ← this is the next link in the chain</text>

  <path class="ln-a" d="M520,400 L520,438" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="560" y="426" font-size="13">link 3: SHA256 of the downloaded .deb vs the digest above</text>

  <rect class="box-ok" x="334" y="442" width="530" height="80" rx="10"/>
  <text class="t-sm" x="352" y="468" font-size="14">nginx-core_1.14.0-2ubuntu3.5_amd64.deb — accepted</text>
  <text class="t-xs" x="352" y="492">Only now is dpkg allowed near the filesystem. Nothing in stages 4–7 can substitute for this.</text>

  <rect class="box-b" x="40" y="150" width="270" height="200" rx="10"/>
  <text class="t-bad" x="58" y="176" font-size="14">what breaks each link</text>
  <text class="t-xs" x="58" y="202">NO_PUBKEY 46432EBA6C3A0FA4</text>
  <text class="t-xs" x="58" y="220">  keyring does not hold the key that signed</text>
  <text class="t-xs" x="58" y="242">EXPKEYSIG / KEYEXPIRED</text>
  <text class="t-xs" x="58" y="260">  the signing key aged out (Ubuntu's 2016</text>
  <text class="t-xs" x="58" y="276">  keyserver outage, briefly, worldwide)</text>
  <text class="t-xs" x="58" y="300">BADSIG</text>
  <text class="t-xs" x="58" y="318">  the body was modified. Treat as hostile.</text>
  <text class="t-xs" x="58" y="340">Release file expired</text>
  <text class="t-xs" x="58" y="356">  Valid-Until passed; you have not updated</text>

  <rect class="box-w" x="40" y="386" width="270" height="200" rx="10"/>
  <text class="t-warn" x="58" y="412" font-size="14">how to tell what is not signed</text>
  <text class="t-xs" x="58" y="438">apt-cache policy</text>
  <text class="t-xs" x="58" y="456">  each repo's priority, and whether it</text>
  <text class="t-xs" x="58" y="472">  came from a lists file or /var/lib/dpkg</text>
  <text class="t-xs" x="58" y="496">apt-get update -o Debug::Acquire::gpgv=true</text>
  <text class="t-xs" x="58" y="516">  the actual gpgv invocation with the keyring</text>
  <text class="t-xs" x="58" y="540">apt-key list   (deprecated; read-only use)</text>
  <text class="t-xs" x="58" y="560">gpg --show-keys /etc/apt/keyrings/x.gpg</text>
</svg>
`
      },
      {
        type: "callout",
        kind: "danger",
        title: "What 'not signed' actually means, and what [trusted=yes] costs you",
        text: "<strong>Not signed</strong> means apt could not verify the index with any key it holds, so it refuses to use the repository at all — it is not that it found a bad signature, it is that it found none it trusts. The fix is to obtain the right key and put it in a keyring <em>you</em> chose, ideally with <code>Signed-By:</code> so it applies to one repository only. <code>[trusted=yes]</code> does the opposite: it tells apt to skip verification for that source, which converts a cryptographic guarantee into a DNS-and-TLS guarantee and makes the whole chain decorative. It exists because some repositories ship unsigned indices and there is no better option; it should never be your default posture. The rule of thumb: if you cannot name the person or organisation whose key you added, you have not added trust, you have only added reachability."
      },
      {
        type: "prose",
        h: "Pinning, priorities, holds and backports",
        p: [
          "Apt picks a candidate version per package by sorting the available versions by <strong>pin priority</strong>, then by version. The default is 500 for every repository. The interesting numbers are the ones where behaviour changes qualitatively, and they are worth knowing by heart because they are also the numbers you put in a <code>preferences</code> file.",
          "A <strong>hold</strong> is the blunt instrument: <code>apt-mark hold nginx</code> pins the currently installed version at priority 1001, so no candidate from anywhere can displace it, and apt will also refuse to remove it. It does not stop dependencies from moving underneath the held package, which is the trap — holding a library while everything else upgrades it forward is how you get a machine where the held package works and everything else subtly does not.",
          "A <strong>pin</strong> is the precise instrument. <code>/etc/apt/preferences</code> and <code>/etc/apt/preferences.d/*.pref</code> match on package name, release (optionally with a version component, e.g. <code>release a=bionic-backports</code>, or <code>release n=bionic</code> for a codename, or <code>release c=main</code> for a component) or an explicit <code>origin</code>/<code>label</code>/<code>site</code> string taken from the Release file. The backports idiom is one file: match the backports suite, give it priority 100, and it will never be installed on its own, but a specific <code>apt install pkg/backports</code> will take it, because an explicit request bypasses the priority ceiling.",
          "The same priority ceiling is the entire reason <code>apt-get install pkg=1.2.3-1</code> and <code>apt-get install pkg/suite</code> work at all. Explicit requests are not resolved through the priority mechanism, so you can install a version from an archive that would never be chosen automatically. That is the mechanism you want for reproducible deployments, and it pairs naturally with <code>apt-mark hold</code> so nothing silently moves afterwards."
        ]
      },
      {
        type: "table",
        cols: ["Pin-Priority", "Behaviour", "Where you actually use it"],
        rows: [
          ["<code>&gt; 1000</code>", "Installs, upgrades, downgrades, and will happily downgrade a working package to satisfy something else. Dangerous by design.", "<code>apt-mark hold</code> writes 1001 for you. Never hand-write a number above 1000."],
          ["<code>1000</code>", "Same as above but not through the hold mechanism. Downgrades are allowed without being asked.", "Only if you really want the resolver to move backwards."],
          ["<code>990</code>", "Installs and upgrades, never downgrades. The sane maximum for a repository you trust and want used.", "A well-behaved third-party repository."],
          ["<code>900</code>", "The same, but the package is always installed even when a higher-priority candidate exists. Use when a package is genuinely required.", "Rare. Forces installation regardless of preference."],
          ["<code>500</code>", "The default. Installs and upgrades, never downgrades.", "Ordinary <code>main</code>, <code>updates</code>, <code>security</code>."],
          ["<code>100</code>", "Never installs or upgrades on its own — but an explicit <code>apt install pkg/suite</code> will take it, and it is already-installed content that will not be downgraded.", "Backports. The canonical use."],
          ["<code>50</code>", "Never upgrades, but will keep an already-installed version present rather than removing it.", "Rarely useful."],
          ["<code>0</code>", "Never installed, never upgraded.", "A repository you want present for dependencies but never for a given package."]
        ]
      },
      {
        type: "code",
        lang: "conf",
        what: "Backports the right way, an exact-version pin, and the check that tells you which repo a package came from",
        code: `# /etc/apt/preferences.d/99-backports
Package: *
Pin: release n=bionic-backports
Pin-Priority: 100

# a single package deliberately held at a known version for reproducibility
Package: nginx*
Pin: version 1.14.0-2ubuntu3.5
Pin-Priority: 1001

# and a check that does not depend on remembering any of it:
$ apt-cache policy nginx
$ apt-cache policy --all-packages | grep -A1 -B1 "500 http"

# explicit versions and suites bypass the priority mechanism entirely:
$ apt-get install nginx=1.14.0-2ubuntu3.5
$ apt-get install -t bionic-backports linux-image-generic
$ apt-mark hold nginx
$ apt-mark showhold

# the difference between hold and pin, demonstrated:
$ apt-get -s upgrade | grep -i nginx
Inst nginx [1.14.0-2ubuntu3.5] (1.14.0-2ubuntu3.6 Ubuntu:18.04/bionic-updates [amd64])
#   with hold:        nothing. apt will not even show it.
#   with pin 100:     still not offered, but "apt install nginx/bionic" would take it.
#   hold also blocks removal; pin does not.

# unattended security updates, and the two files that control them
# /etc/apt/apt.conf.d/20auto-upgrades
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";

# /etc/apt/apt.conf.d/50unattended-upgrades — the policy list.
# Defaults to "security" (and on Ubuntu, bionic-updates once it exists).
# A reboot-required package (linux-image-*) means the machine now needs a reboot
# you have not scheduled. That is a policy decision, not a bug.

$ systemctl status unattended-upgrades
$ tail -50 /var/log/unattended-upgrades/unattended-upgrades.log`
      },
      {
        type: "prose",
        h: "Why mixing Debian and Ubuntu repositories ruins a machine slowly",
        p: [
          "Adding a Debian repository to an Ubuntu system, or an Ubuntu one to Debian, is not a version-mismatch error that apt can catch. It is a slow divergence of a whole C/C++ runtime stack, and the symptoms arrive days later in packages that have nothing to do with what you changed.",
          "The reason is that Ubuntu carries systematic patches to <code>libc6</code>, <code>libstdc++6</code>, <code>systemd</code>, <code>dpkg</code>, <code>util-linux</code> and a few dozen other foundational packages, and it expresses those patches only as a version suffix: <code>1:2.27-3ubuntu1.6</code> against Debian's <code>2.28-10</code>. The versions compare, the resolver is satisfied, and every declared <code>Depends</code> is technically met. What apt cannot see is that the two trees expect different struct layouts, different <code>ERROR</code> handling in <code>execve</code> failure paths, and different systemd unit semantics. So you install a Debian binary package, it pulls in a Debian <code>libfoo</code>, which pulls in a Debian <code>libstdc++</code>, and somewhere in there a stack frame is the wrong size.",
          "When it surfaces, it surfaces as <code>Segmentation fault</code> in a daemon that was working yesterday, <code>symbol lookup error</code> at <code>dlopen</code> time, an <code>init: unknown opcode</code> from systemd, or a <code>Bus error</code> in a core file. None of those point back at the repository you added. Meanwhile apt's state is self-consistent, so <code>apt-get -f install</code> and <code>dpkg --configure -a</code> both report success and change nothing, which is the most maddening possible failure mode: the tooling says everything is fine while the machine is subtly broken.",
          "The safe rule: a distribution is a unit. Use repositories built for that release, from that vendor, with that vendor's key. If you need something from another distribution, get the vendor's own build or use a container. And if you have already done it, the recovery is not <code>apt-get install --reinstall</code>; it is restoring the base image and replaying your own changes, because you cannot enumerate which of the 400 installed packages now contains foreign code."
        ]
      },
      {
        type: "diagram",
        h: "Where the Debian/Ubuntu mix actually breaks",
        caption: "The dashed edges are dependencies apt can satisfy on paper and the runtime cannot survive. Nothing here produces an error at install time, which is exactly why the damage is not self-announcing. The glibc and libstdc++ layer is the load-bearing one: it is shared by every C and C++ binary on the machine, including python3 and systemd.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Stack showing where Ubuntu and Debian packages cross and produce runtime failures that package managers cannot detect">
  <text class="t-title" x="40" y="34" font-size="17">you added deb http://deb.debian.org/debian stretch main to sources.list</text>

  <rect class="box-ok" x="40" y="52" width="480" height="286" rx="11"/>
  <text class="t-ok" x="58" y="78" font-size="15">installed from Ubuntu bionic — coherent</text>
  <rect class="box-v" x="58" y="92" width="200" height="44" rx="7"/>
  <text class="t-sm" x="72" y="120">libc6 2.27-3ubuntu1.6</text>
  <rect class="box-v" x="270" y="92" width="232" height="44" rx="7"/>
  <text class="t-sm" x="284" y="120">libstdc++6 8-20180414</text>
  <rect class="box-v" x="58" y="146" width="200" height="44" rx="7"/>
  <text class="t-sm" x="72" y="174">systemd 237-3ubuntu1</text>
  <rect class="box-v" x="270" y="146" width="232" height="44" rx="7"/>
  <text class="t-sm" x="284" y="174">dpkg 1.19.0.5ubuntu2</text>
  <rect class="box-v" x="58" y="200" width="444" height="44" rx="7"/>
  <text class="t-sm" x="72" y="228">nginx 1.14.0-2ubuntu3.5 + nginx-core, nginx-common</text>
  <rect class="box-v" x="58" y="254" width="200" height="44" rx="7"/>
  <text class="t-sm" x="72" y="282">python3 3.6.9</text>
  <rect class="box-v" x="270" y="254" width="232" height="44" rx="7"/>
  <text class="t-sm" x="284" y="282">openssl 1.1.0g-2ubuntu4</text>
  <text class="t-xs" x="58" y="322">every -2ubuntuN.M suffix is a patch Debian does not have</text>

  <rect class="box-b" x="552" y="52" width="508" height="286" rx="11"/>
  <text class="t-bad" x="570" y="78" font-size="15">installed from Debian stretch — individually fine</text>
  <rect class="box-p" x="570" y="92" width="232" height="44" rx="7"/>
  <text class="t-sm" x="584" y="120">libcurl3 7.52.1-5+deb9u9</text>
  <rect class="box-p" x="814" y="92" width="228" height="44" rx="7"/>
  <text class="t-sm" x="828" y="120">libgnutls30 3.6.7-4+deb9u4</text>
  <rect class="box-p" x="570" y="146" width="232" height="44" rx="7"/>
  <text class="t-sm" x="584" y="174">libstdc++6 6.3.0-18</text>
  <rect class="box-p" x="814" y="146" width="228" height="44" rx="7"/>
  <text class="t-sm" x="828" y="174">libc6 2.24-11+deb9u4</text>
  <rect class="box-p" x="570" y="200" width="472" height="44" rx="7"/>
  <text class="t-sm" x="584" y="228">some-tool 2.4.1-5~bpo9+1   (Depends: libstdc++6 (&gt;= 6.3.0))</text>
  <rect class="box-p" x="570" y="254" width="472" height="44" rx="7"/>
  <text class="t-sm" x="584" y="282">zlib1g 1:1.2.11.dfsg-2   apt calls this an UPGRADE</text>
  <text class="t-xs" x="570" y="322">apt sees a newer version. It is a different operating system.</text>

  <path class="ln-b dash" d="M686,136 L686,146" marker-end="url(#lm-arrow-bad)"/>
  <path class="ln-b dash" d="M928,190 L928,228" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-w" x="40" y="360" width="1020" height="130" rx="11"/>
  <text class="t-warn" x="58" y="386" font-size="15">what apt cannot see, and the runtime cannot forgive</text>
  <text class="t-xs" x="58" y="412">glibc and libstdc++ carry struct layouts, errno numbering, signal and locale semantics that differ between 2.24 and 2.27. A binary</text>
  <text class="t-xs" x="58" y="432">compiled against one and run against the other reads the wrong offsets. dpkg's version comparison says the Depends is satisfied.</text>
  <text class="t-xs" x="58" y="454">systemd 237 and Debian's systemd 232 disagree about unit directives; a unit written for one is rejected or, worse, silently misparsed by</text>
  <text class="t-xs" x="58" y="476">the other. dpkg itself gets swapped underneath apt, which is the layer you were relying on to tell you anything at all.</text>

  <rect class="box-b" x="40" y="510" width="1020" height="96" rx="11"/>
  <text class="t-bad" x="58" y="536" font-size="15">the symptoms, days later, in packages that have nothing to do with the change</text>
  <text class="t-xs" x="58" y="560">Segmentation fault (core dumped) in a daemon · /usr/bin/foo: symbol lookup error: undefined symbol · systemd: Failed to create manager:</text>
  <text class="t-xs" x="58" y="578">Bus error · glibc: double free or corruption (fasttop) · apt-get -f install: no errors, no changes · dpkg --configure -a: also nothing</text>
  <text class="t-xs" x="58" y="600">Recovery is restoring the image. There is no supported way to subtract foreign packages from a live system.</text>
</svg>
`
      },
      {
        type: "table",
        cols: ["", "dpkg / apt (Debian, Ubuntu)", "rpm / dnf (Fedora, RHEL, CentOS)", "pacman (Arch)"],
        rows: [
          ["Database", "<code>/var/lib/dpkg/status</code>, one text file. <code>/var/lib/dpkg/info/*.list</code> is the file index.", "<code>/var/lib/rpm/</code> BDB/SQLite, then <code>/usr/lib/sysimage/rpm</code> from Fedora 31 and dnf 4. <code>Files</code>, <code>Basenames</code> are the indexes.", "A directory: <code>/var/lib/pacman/local/&lt;pkg&gt;/</code> with <code>desc</code>, <code>files</code>, <code>install</code>, <code>mtree</code>. Filesystem-shaped."],
          ["Database format", "Text. <code>grep</code> is a legitimate query tool.", "Binary. <code>rpm -qa --qf</code> is the only sane way in, and dnf wraps it.", "Text in a directory. Best of the three for debugging by hand."],
          ["Dependency solving", "apt's own solver, versioned, handles alternatives, virtual packages, pinning.", "libsolv via dnf. Better at multilib and modular streams; also honours vendor change sets.", "<strong>None.</strong> Only providers, no version comparison. This is why Arch versions move in lockstep and nothing can be held back."],
          ["Config files", "<code>conffiles</code>; unedited files updated silently, edited ones become <code>.dpkg-new</code>.", "<code>%config(noreplace)</code>; same semantics via <code>rpmdiff</code>.", "New files land as <code>foo.conf</code> plus <code>foo.conf.pacnew</code>, only if you had edited yours. No merging, ever."],
          ["Scripts", "<code>preinst</code>/<code>postinst</code>/<code>prerm</code>/<code>postrm</code> plus <code>triggers/</code> — the trigger mechanism is uniquely Debian's and unusually useful.", "<code>%pre</code>/<code>%post</code>/<code>%preun</code>/<code>%postun</code> plus scriptlet triggers, which do the same job with a different syntax.", "<code>.INSTALL</code> only. Deliberately minimal: almost nothing should touch the filesystem outside <code>/usr</code>."],
          ["Verification", "<code>dpkg -V</code> against per-package <code>md5sums</code>.", "<code>rpm -Va</code>, and <code>dnf check</code> for consistency. SELinux relabelling is a separate concern entirely.", "<code>pacman -Qkk</code> against the <code>mtree</code>. Fast, and catches a surprising amount."],
          ["Rollback", "None. <code>/var/backups</code> keeps a few days of pre-upgrade binaries and conffiles, nothing more.", "<strong><code>dnf history undo &lt;id&gt;</code></strong> — the only mainstream package manager with a real undo, because the data is content-addressed in the rpmdb and the repo keeps old packages.", "None. Arch's rolling model means you can only go forward, and the cache is wiped on upgrade."],
          ["Hooks", "<code>dpkg.cfg.d/</code> triggers, <code>apt.conf.d/</code>, <code>hooks/</code> for APT.", "<code>%transfiletriggerin</code>, RPM plugins, <code>dnf.conf.d/</code>.", "<strong><code>/etc/pacman.d/hooks/</code></strong> — first-class, declarative, directory-wide, and the reason <code>mkinitcpio</code> and <code>pamacaur</code> work at all."],
          ["Partial upgrade", "Possible and the source of most breakage.", "Possible; <code>dnf --allowerasing</code> and <code>--nobest</code> let you do things that dnf will not do on its own.", "<strong>Explicitly unsupported.</strong> If a partial upgrade is detected, the AUR helpers and mirrors are blocked until fixed."],
          ["When you want it", "Servers and containers on the two largest Debian derivatives. Best .deb coverage, by a wide margin. <code>apt</code>'s output is the most legible of the three.", "Anything where you need SELinux policy integration, RHEL ABI guarantees, or <code>dnf history</code> in an incident.", "Rolling, minimal, current, and where you want to read every script that touches your system."]
        ]
      },
      {
        type: "prose",
        h: "Snap, Flatpak, Nix: three different answers to 'the package broke'",
        p: [
          "All three exist because the traditional model has a real weakness: one shared <code>/usr</code> means one library version per machine, and any upgrade is a machine-wide event. Their answers differ in what they make immutable, and in what that costs.",
          "<strong>Snap</strong> makes the <em>application</em> immutable. Each revision is a squashfs image under <code>/var/lib/snapd/snaps/</code>, mounted by the <code>squashfuse</code> driver over a loop device by <code>snapd</code>, and the package declares AppArmor profiles, seccomp filters, a namespace layout and an interface list. Strict confinement is genuinely strong: the application cannot see <code>/home</code>, cannot open a socket you have not granted, and cannot write outside <code>/var/snap/&lt;name&gt;</code> — you get a message telling you which interface to connect, and <code>apt install snapd</code> + <code>snap connect name:network</code> is a real and readable workflow. The costs are substantial: a loop-mounted squashfs per revision, disk on a 19 GB VPS that you may not have budgeted, the fact that a confined snap cannot bind <code>127.0.0.53</code> or read your certificates without extra plumbing, and that the store refreshes revisions in the background on a schedule you do not control — <code>snap refresh --time</code> is how you find out when. Classic confinement means none of the above applies, which makes it a snap in name only. For a headless server the honest answer is: almost never a snap.",
          "<strong>Flatpak</strong> makes the application <em>and its entire runtime</em> immutable, and is the only one of the three that uses real namespaces as the containment primitive — bubblewrap builds a mount namespace, PID namespace and optionally a network namespace, then pivot_roots into an OSTree checkout. The OSTree repositories (system-wide in <code>/var/lib/flatpak</code>, or per-user in <code>~/.local/share/flatpak</code>) are content-addressed and updates are atomic: either a whole runtime version arrives or none of it does. Access to the host filesystem goes through <strong>portals</strong> — a D-Bus service (<code>xdg-desktop-portal</code>) that mediates file chooser and screenshot requests, so a sandboxed app literally cannot enumerate your home directory. The cost is duplication: every app carries its own GNOME, its own Firefox, its own libc, and the runtimes are separate downloads. Good for desktops, wrong for a VPS.",
          "<strong>Nix</strong> inverts the model entirely: nothing is ever overwritten. Every build produces a content-addressed path <code>/nix/store/&lt;32-char-hash&gt;-&lt;name&gt;-&lt;version&gt;</code> whose permissions are read-only and whose hash covers its build inputs. A profile is a symlink to a generation, and switching profiles is a symlink swap, so installing, upgrading and rolling back are the same operation and rollback is exact. The build sandbox gives you the reproducibility guarantee: because the build process can only see declared inputs, the same nixpkgs revision produces the same bytes on any machine. You get <code>/run/current-system/sw</code> as a self-contained system root with its own <code>/etc</code>, which is how a Nix machine has no <code>/etc/passwd</code> and runs daemons under a synthetic account. The costs are real: <code>/nix/store</code> grows without limit until you garbage collect, and deleting an old profile is a two-step operation most people forget, so a Nix machine that has been running for a year holds a great deal. <code>nix-collect-garbage -d</code> and then <code>nix-store --gc</code> with the daemon running. On Ubuntu 18.04, <code>nix-bin</code> is in <code>universe</code> and gives you 2.0 with channels but not flakes, which is the version everybody now writes for."
        ]
      },
      {
        type: "cards",
        items: [
          {
            title: "Snap",
            tag: "IMMUTABLE APP",
            tone: "violet",
            text: "Immutable: the application revision. <b>Where:</b> <code>/var/lib/snapd/snaps/*.squashfs</code>, mounted over a loop device, data in <code>/var/snap</code>. <b>Confinement:</b> AppArmor + seccomp + namespaces + an interface list. <b>Refresh:</b> automatic, every few days, backgrounded. <b>Costs:</b> a loop mount and squashfs per revision, unpredictable disk growth, and a store you do not control. <b>On this VPS:</b> hard to justify — snapd itself is a daemon you now have to patch and monitor."
          },
          {
            title: "Flatpak",
            tag: "IMMUTABLE APP + RUNTIME",
            tone: "violet",
            text: "Immutable: the app and its whole runtime. <b>Where:</b> OSTree checkouts in <code>/var/lib/flatpak</code> or <code>~/.local/share/flatpak</code>, atomic per remote. <b>Confinement:</b> bubblewrap namespaces + seccomp, with host access only through xdg-desktop-portal. <b>Costs:</b> runtime duplication — every app brings its own GNOME and its own Firefox. <b>Best at:</b> desktops where a stale library in the host is the actual problem."
          },
          {
            title: "Nix",
            tag: "FUNCTIONAL STORE",
            tone: "ok",
            text: "Immutable: everything, always, by construction. <b>Where:</b> <code>/nix/store/&lt;hash&gt;-name-version</code>, read-only, content-addressed; profiles are symlinks in <code>/nix/var/nix/profiles</code> → <code>/run/current-system</code>. <b>Wins:</b> exact rollback, a build sandbox that makes inputs complete, and a system root that is itself a store path. <b>Costs:</b> disk grows until you garbage collect, and the learning curve is real. <b>Rollback:</b> <code>nix-env -iA nixpkgs.somePkg -set &lt;old&gt;</code> is instant and byte-exact."
          },
          {
            title: "AppImage",
            tag: "SINGLE FILE",
            tone: "warn",
            text: "Immutable: one file. Squashfs with a FUSE launcher, self-contained, no daemon, no store. <b>Costs:</b> no sandboxing whatsoever — it runs with your full privileges, so you must trust the file the same way you trust a <code>make install</code>. <b>Use when:</b> handing one binary to a machine you do not administer."
          },
          {
            title: "Guix",
            tag: "NIX, DEBIAN-FREE",
            tone: "warn",
            text: "Same model as Nix, GNU implementation, and the only one of the family whose package graph genuinely excludes Debian. Every dependency is rebuilt from source rather than borrowed from the host, which is the point: nothing from your system can influence the build. <b>Costs:</b> the smallest community of the four."
          },
          {
            title: "V Containers / OCI layers",
            tag: "THE REAL ONE",
            tone: "ok",
            text: "The layer model containers actually use. Overlayfs lowerdir per image layer, read-only, shared; upperdir per container, writable; whiteouts for deletions. <b>Costs:</b> lookup cost grows with layer depth, whiteouts accumulate, hardlinks cannot cross layers. <b>Note:</b> a container that runs <code>apt-get install</code> in its own layer gives you the same rollback story as a Nix profile, with none of the reproducibility."
          }
        ]
      },
      {
        type: "diagram",
        h: "Where each model puts the files",
        caption: "The FHS split between <code>/usr</code> (the operating system) and <code>/var</code> (the state) is what makes a traditional upgrade a machine-wide event: everything in <code>/usr</code> is owned by packages, so changing one version of anything changes all of it. Every immutable model answers this by refusing to share a writable location at all.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Install locations for apt, dnf, pacman, Nix, snap, flatpak and OCI containers across /usr /var /opt /nix">
  <text class="t-title" x="40" y="34" font-size="17">one machine, five models of "where does this file go"</text>

  <rect class="box-ok" x="40" y="52" width="330" height="270" rx="11"/>
  <text class="t-ok" x="58" y="78" font-size="15">apt / dnf / pacman — shared, mutable</text>
  <text class="t-xs" x="58" y="104">/usr/bin, /usr/lib, /usr/share</text>
  <text class="t-xs" x="58" y="126">/etc      — config, owned by packages</text>
  <text class="t-xs" x="58" y="148">/var/lib/dpkg     or  /usr/lib/sysimage/rpm</text>
  <text class="t-xs" x="58" y="166">or /var/lib/pacman/local</text>
  <text class="t-xs" x="58" y="190">/usr/local        — deliberately outside package ownership</text>
  <text class="t-xs" x="58" y="216" font-size="14">upgrade = overwrite in place</text>
  <text class="t-xs" x="58" y="238">rollback = you do not have one</text>
  <text class="t-xs" x="58" y="260">conffile drift = your fault, per Debian</text>
  <text class="t-xs" x="58" y="286">one lib version per machine, always</text>
  <text class="t-xs" x="58" y="310">/usr/local is the escape hatch that becomes</text>
  <text class="t-xs" x="58" y="326">the place nobody upgrades any more</text>

  <rect class="box-w" x="392" y="52" width="330" height="270" rx="11"/>
  <text class="t-warn" x="410" y="78" font-size="15">snap — immutable revision + writable data</text>
  <text class="t-xs" x="410" y="104">/var/lib/snapd/snaps/*.squashfs</text>
  <text class="t-xs" x="410" y="126">  mounted over a loop device by squashfuse</text>
  <text class="t-xs" x="410" y="148">/var/snap/&lt;name&gt;  — the writable side</text>
  <text class="t-xs" x="410" y="176" font-size="14">refresh = mount a new revision</text>
  <text class="t-xs" x="410" y="198">rollback = snap revert, instant</text>
  <text class="t-xs" x="410" y="226">disk: every revision kept until pruned</text>
  <text class="t-xs" x="410" y="252">confinement is real and it is strict —</text>
  <text class="t-xs" x="410" y="270">strict snaps need explicit interfaces,</text>
  <text class="t-xs" x="410" y="288">classic snaps are unrestricted</text>
  <text class="t-xs" x="410" y="310">/snap/&lt;name&gt;/current is a symlink</text>

  <rect class="box-p" x="744" y="52" width="316" height="270" rx="11"/>
  <text class="t-bad" x="762" y="78" font-size="15">flatpak — immutable app + runtime</text>
  <text class="t-xs" x="762" y="104">/var/lib/flatpak/app/&lt;id&gt;/&lt;ver&gt;/</text>
  <text class="t-xs" x="762" y="122">~/.local/share/flatpak/app/…</text>
  <text class="t-xs" x="762" y="144">/var/lib/flatpak/runtime/&lt;runtime&gt;/</text>
  <text class="t-xs" x="762" y="166">OSTree: content-addressed, atomic updates</text>
  <text class="t-xs" x="762" y="194" font-size="14">update = fetch + switch a ref atomically</text>
  <text class="t-xs" x="762" y="216">no host access without a portal</text>
  <text class="t-xs" x="762" y="240">bubblewrap builds the namespaces at</text>
  <text class="t-xs" x="762" y="258">launch, then pivot_root into it</text>
  <text class="t-xs" x="762" y="282">disk: a full runtime per app version</text>
  <text class="t-xs" x="762" y="308">flatpak is the only one of the three</text>
  <text class="t-xs" x="762" y="324">that shares the container mechanism</text>

  <rect class="box-v" x="40" y="348" width="500" height="268" rx="11"/>
  <text class="t-violet" x="58" y="374" font-size="15">nix — nothing is ever overwritten</text>
  <rect class="box" x="58" y="388" width="464" height="80" rx="8"/>
  <text class="t-sm" x="74" y="412">/nix/store/1v3k9m0…-openssl-1.1.1a</text>
  <text class="t-sm" x="74" y="434">/nix/store/8c2m4x1…-openssl-1.1.1b</text>
  <text class="t-sm" x="74" y="456">both exist, both are read-only, the hash is over the inputs</text>
  <text class="t-xs" x="58" y="494">/nix/var/nix/profiles/system → link-1, link-2, …</text>
  <text class="t-xs" x="58" y="516">/run/current-system/sw        — a full system root, as a store path</text>
  <text class="t-xs" x="58" y="540">nix-env -i … -set /nix/var/nix/profiles/per-user/root/profile</text>
  <text class="t-xs" x="58" y="560">upgrades add generations; rollback is picking an older link</text>
  <text class="t-xs" x="58" y="584">the build sandbox sees only declared inputs, so the hash is a</text>
  <text class="t-xs" x="58" y="602">reproducibility claim and not merely a name</text>

  <rect class="box-ok" x="562" y="348" width="498" height="268" rx="11"/>
  <text class="t-ok" x="580" y="374" font-size="15">OCI container — the layered version of the same idea</text>
  <text class="t-xs" x="580" y="402">image = ordered lowerdir list, read-only, shared between containers</text>
  <text class="t-xs" x="580" y="424">/var/lib/docker/overlay2/&lt;id&gt;/diff  — the writable upperdir</text>
  <text class="t-xs" x="580" y="446">/var/lib/docker/overlay2/&lt;id&gt;/work  — the scratch workdir</text>
  <text class="t-xs" x="580" y="470">apt inside a container writes into diff, so the image never changes</text>
  <text class="t-xs" x="580" y="492">docker commit  bakes the diff into a new immutable layer</text>
  <text class="t-xs" x="580" y="514">on a 19 GB VPS, /var/lib/docker is usually the first thing that fills</text>
  <text class="t-xs" x="580" y="540" font-size="14">the practical comparison</text>
  <text class="t-xs" x="580" y="564">apt: smallest disk, machine-wide blast radius, no rollback</text>
  <text class="t-xs" x="580" y="584">dnf: rollback via history undo, larger repo, bigger download</text>
  <text class="t-xs" x="580" y="604">nix/flattpak/snap: best isolation, most disk, most new concepts</text>
</svg>
`
      },
      {
        type: "prose",
        h: "upgrade, full-upgrade, and the day the suite changes",
        p: [
          "Three words, three algorithms, and the difference between them is the only reason a security update sometimes refuses to install.",
          "<code>apt-get update</code> touches nothing. It re-downloads the signed indexes into <code>/var/lib/apt/lists/</code> and verifies them. Everything else depends on it having been run recently enough that you are not making decisions from stale data. The <code>Valid-Until</code> field in the Release file is what makes apt tell you so rather than silently serving you a three-month-old dependency graph.",
          "<code>apt-get upgrade</code> installs new versions of packages that are already installed, and will <em>not</em> install a new package or remove an existing one, ever. If the only way to upgrade package A is to remove package B, upgrade refuses and tells you to use <code>full-upgrade</code>. That conservatism is the property people rely on: an upgrade will not silently remove a package you never asked about. The visible price is a security fix that keeps saying no.",
          "<code>apt-get dist-upgrade</code>, now also spelled <code>full-upgrade</code> (apt added the alias in 1.1 and deprecated the old name in 1.3; Ubuntu 18.04 has apt 1.6 and warns you about the spelling but honours both), will add and remove packages to satisfy the dependency graph. This is the one that carries a release: the suite field in your sources.list changes from <code>bionic</code> to <code>focal</code>, hundreds of packages cross suites at once, and the resolver has to make the entire machine consistent with the new suite.",
          "The word that matters here is <strong>suite</strong>. A <code>bionic</code> to <code>bionic-updates</code> or <code>bionic-security</code> change is an upgrade — same suite, different versions, no structural change. A <code>bionic</code> to <code>focal</code> change is a distribution upgrade: libc, systemd, the init system expectations, and the package set all move together, and it is not a mechanical operation. That is what <code>do-release-upgrade</code> exists for. It is a Python program shipped in <code>update-manager-core</code> that refuses to run unattended, walks the suite change through several metapackage-driven phases so that you are never left with a half-switched system, downloads and keeps a recovery tarball of your state beforehand, and rewrites <code>/etc/apt/sources.list</code> for you. The failure mode you should know about is the one where it stops with <code>E: Packages were removed and are no longer required and have been autoremoved</code> or <code>Error: Broken pipe</code>, having already changed the sources; the fix is always <code>apt-get -f install</code>, and the diagnostic is always <code>grep -r focal /etc/apt/sources.list.d/ /etc/apt/sources.list</code> to see how far it got."
        ]
      },
      {
        type: "diagram",
        h: "Where upgrade stops and full-upgrade starts",
        caption: "The graph has exactly one incompatibility: the new <code>libfoo</code> requires <code>libc6 &gt;= 2.30</code>, which forces <code>libc6</code> forward, which conflicts with the pinned <code>legacy-agent</code>. <code>upgrade</code> will not do that, by design, and says so. <code>full-upgrade</code> removes the legacy agent. Neither command can break your system on its own — but <code>full-upgrade</code> can remove something you did not know you depended on, and on a VPS that removed binary is the one that was quietly running your cron jobs.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="Dependency graph where a security update is blocked by an exact dependency and full-upgrade resolves it by removal">
  <rect class="box-b" x="40" y="24" width="1020" height="86" rx="10"/>
  <text class="t-bad" x="58" y="50" font-size="15">the situation</text>
  <text class="t-xs" x="58" y="74">bionic-updates ships openssl 1.1.1f-1ubuntu2.4 fixing CVE-2021-3711. Nothing on the machine says "upgrade me", so nothing will.</text>
  <text class="t-xs" x="58" y="96">Until you run one, and then it refuses — not because of the fix, but because of an unrelated package that pins the old ABI.</text>

  <rect class="box" x="40" y="130" width="1020" height="240" rx="10"/>

  <rect class="box-ok" x="70" y="156" width="200" height="54" rx="8"/>
  <text class="t-sm" x="170" y="180" text-anchor="middle">openssl 1.1.1f-1ubuntu2.3</text>
  <text class="t-xs" x="170" y="200" text-anchor="middle">installed, vulnerable</text>

  <path class="ln-ok" d="M270,183 L350,183" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="310" y="173" font-size="12" text-anchor="middle">+ openssl</text>

  <rect class="box-ok" x="354" y="156" width="220" height="54" rx="8"/>
  <text class="t-sm" x="464" y="180" text-anchor="middle">libssl1.1 1.1.1f-1ubuntu2.4</text>
  <text class="t-xs" x="464" y="200" text-anchor="middle">Depends: libc6 (&gt;= 2.27)</text>

  <path class="ln-b" d="M574,183 L654,183" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="614" y="170" font-size="12" text-anchor="middle">forces</text>

  <rect class="box-w" x="658" y="156" width="220" height="54" rx="8"/>
  <text class="t-sm" x="768" y="180" text-anchor="middle">libc6 2.31-0ubuntu9</text>
  <text class="t-xs" x="768" y="200" text-anchor="middle">only available on the NEW suite</text>

  <path class="ln-b" d="M768,210 L768,252" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="790" y="238" font-size="12">this is the fork in the road</text>

  <rect class="box-p" x="658" y="256" width="200" height="54" rx="8"/>
  <text class="t-sm" x="758" y="280" text-anchor="middle">legacy-agent 1.2.0</text>
  <text class="t-xs" x="758" y="300" text-anchor="middle">Depends: libc6 (= 2.27-3ubuntu1)</text>

  <path class="ln-b dash" d="M656,283 L586,283" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="620" y="272" font-size="12" text-anchor="middle">Breaks:</text>

  <rect class="box-w" x="360" y="256" width="220" height="54" rx="8"/>
  <text class="t-sm" x="470" y="280" text-anchor="middle">the other way out</text>
  <text class="t-xs" x="470" y="300" text-anchor="middle">build it against the new libc, or</text>
  <text class="t-xs" x="470" y="318" text-anchor="middle">ship a statically linked binary</text>

  <path class="ln" d="M170,210 L170,256" marker-end="url(#lm-arrow)"/>
  <rect class="box-v" x="70" y="256" width="200" height="54" rx="8"/>
  <text class="t-sm" x="170" y="280" text-anchor="middle">nginx-core 1.14.0-2u3.5</text>
  <text class="t-xs" x="170" y="300" text-anchor="middle">Depends: libssl1.1 (= 1.14-era)</text>

  <rect class="box-a" x="40" y="396" width="500" height="128" rx="10"/>
  <text class="t-accent" x="58" y="422" font-size="15">apt-get upgrade</text>
  <text class="t-xs" x="58" y="448">The following packages have unmet dependencies:</text>
  <text class="t-xs" x="58" y="470">libssl1.1 : Breaks: legacy-agent (&lt; 2) but 1.2.0 is to be installed</text>
  <text class="t-xs" x="58" y="494">E: Packages were broken and -f was used, or the hold made it impossible.</text>
  <text class="t-xs" x="58" y="514">It will NOT install a new package and will NOT remove one. This is a feature.</text>

  <rect class="box-ok" x="560" y="396" width="500" height="128" rx="10"/>
  <text class="t-ok" x="578" y="422" font-size="15">apt-get full-upgrade   (aka dist-upgrade)</text>
  <text class="t-xs" x="578" y="448">The following packages will be REMOVED:</text>
  <text class="t-xs" x="578" y="470">  legacy-agent</text>
  <text class="t-xs" x="578" y="494">The following NEW packages will be installed: libc6 …</text>
  <text class="t-xs" x="578" y="514">Which is a silent outage if you did not know what legacy-agent was for.</text>

  <rect class="box" x="40" y="548" width="1020" height="96" rx="10"/>
  <text class="t-sm" x="58" y="574" font-size="15">the suite boundary — the thing upgrade cannot cross</text>
  <text class="t-xs" x="58" y="598">bionic → bionic-updates, bionic → bionic-security: same suite, an upgrade. Thousands of packages, no structural change.</text>
  <text class="t-xs" x="58" y="620">bionic → focal: a different suite. libc, systemd, the package set and every dependency all move at once.</text>
  <text class="t-xs" x="58" y="638">apt-get upgrade refuses to cross it by design. Use do-release-upgrade, and read what it says.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "The maintenance cycle, and the three questions that make it safe",
        code: `# the loop, in the order that actually matters
$ sudo apt-get update                  # nothing is installed. everything else depends on this.
$ apt-get -s full-upgrade             # -s = simulate. READ the removal list before you commit.
$ sudo apt-get full-upgrade
$ sudo apt-get autoremove --dry-run   # then without --dry-run, if the list is short
$ sudo apt-get clean                  # free the .debs. on 19 GB, this is not optional.

# what is about to change, and is any of it held?
$ apt list --upgradable
$ apt-mark showhold
$ apt-get -s dist-upgrade | grep -E '^(Remv|Inst)'

# what would break if a service restarted mid-upgrade?
$ systemctl list-units --type=service --state=running
$ ls /etc/*.dpkg-dist /etc/*/*.dpkg-dist 2>/dev/null    # config drift you have not merged

# reboot required? this is a file, not a guess
$ test -f /var/run/reboot-required && cat /var/run/reboot-required.pkgs
#   on Ubuntu the packages that trigger it are in /usr/lib/update-notifier/...

# unattended-upgrades, for the security archive only
# /etc/apt/apt.conf.d/50unattended-upgrades, uncomment:
Unattended-Upgrade::Allowed-Origins {
        "\${distro_id}:\${distro_codename}-security";
#       "\${distro_id}:\${distro_codename}-updates";     <- opt in, it does pull in new packages
};
# a kernel update without a reboot means the machine is running a patched config
# and an unpatched kernel until someone restarts it. That is a policy decision.

# the release upgrade, which is a different program
$ sudo apt-get install update-manager-core
$ sudo do-release-upgrade
#   refuses to run unattended, takes a backup of /etc first, and upgrades in phases.
#   do NOT run it over SSH without a second way in — it touches sshd, and a botched
#   network config or a firewall rule change is a box you cannot reach.
#   if it stops partway: grep -rn focal /etc/apt/sources.list*   then   apt-get -f install

# and the one-line pin for a reproducible deploy
$ sudo apt-get install nginx=1.14.0-2ubuntu3.5 && sudo apt-mark hold nginx
$ apt-cache policy nginx        # verify the pinned version is still what is installed`
      },
      {
        type: "callout",
        kind: "boss",
        title: "The rule that prevents most package incidents",
        text: "Never run a package command on a production host as a reflex. Run <code>apt-get -s</code> first and read two lines: the list of packages that will be REMOVED, and whether any of them own files you did not know about. <code>apt-get install -s foo</code> and <code>apt-get -s full-upgrade</code> cost nothing, change nothing, and answer the only question that matters — what is this about to take away from me. Every production package incident in my experience started as a skipped simulation."
      },
      {
        type: "kv",
        items: [
          { k: "deb vs deb-src", v: "Binary packages versus source. Only <code>deb-src</code> lines give you <code>apt-get source</code>, and they are commented out by default on Ubuntu for bandwidth reasons." },
          { k: "suite / component", v: "<code>bionic</code> is the codename for 18.04. <code>bionic-updates</code> and <code>bionic-security</code> are separate archives for the same suite. <code>main</code> is supported free software; <code>universe</code> is free and community-maintained, and does not get security priorities." },
          { k: "InRelease vs Release.gpg", v: "Inline-clearsigned versus detached signature. Same trust, different wire format; InRelease is one HTTP request instead of two." },
          { k: "Valid-Until", v: "The field that makes a stale mirror fail loudly rather than serving you a three-month-old dependency graph." },
          { k: "Pin-Priority", v: "A number per package-and-source that decides whether apt will install, upgrade, or refuse. 500 is the default; 100 means 'only if explicitly asked'; above 1000 allows downgrades." },
          { k: "hold vs pin", v: "A hold is a pin of 1001 that also blocks removal, set by <code>apt-mark hold</code>. It does not protect a package from its dependencies moving underneath it." },
          { k: "conffiles", v: "The list of paths dpkg will not silently overwrite. An edited one survives an upgrade and arrives as <code>.dpkg-new</code>; that file is evidence of drift, not clutter." },
          { k: "ok installed", v: "The only fully healthy dpkg state. Anything else has a letter in the second column of <code>dpkg -l</code> telling you where it stopped." },
          { k: "dist-upgrade / full-upgrade", v: "Will add and remove packages to satisfy the graph. <code>full-upgrade</code> is the current name; <code>dist-upgrade</code> is the deprecated alias that still works." },
          { k: "do-release-upgrade", v: "A Python program in <code>update-manager-core</code> for crossing a suite boundary. Refuses unattended, backs up <code>/etc</code>, upgrades in phases, and rewrites your sources." },
          { k: "autoremove", v: "Removes packages that were installed only as dependencies and are no longer needed. Always simulate it: it is the command that deletes the thing nobody remembered installing." }
        ]
      }
    ],
    takeaways: [
      "A .deb is an <code>ar</code> archive of a version stamp, a metadata tarball and a data tarball. Everything intelligent is in the control member and in the scripts; the payload is just files.",
      "apt resolves and downloads, dpkg installs. apt never touches the filesystem, dpkg never resolves anything, and every confusing message belongs unambiguously to one of the two.",
      "dpkg's state machine is plain text in <code>/var/lib/dpkg/status</code>. <code>ok installed</code> is the only good state, and <code>dpkg --configure -a</code> is the universal repair for everything else.",
      "The trust chain is one signature over the Release file, then arithmetic. The keyring is the only thing taken on faith, which is why <code>Signed-By</code> per repository matters and <code>[trusted=yes]</code> does not.",
      "Pin priority is where reproducibility comes from: 500 by default, 100 means backports, 1001 is a hold, and an explicit <code>pkg=version</code> bypasses the ceiling entirely.",
      "Mixing Debian and Ubuntu repositories produces a machine that apt considers correct and that segfaults, because the solver compares versions and has no concept of an ABI. Recovery is a new image, not a reinstall.",
      "<code>apt-get upgrade</code> will not remove or add packages and says so; <code>full-upgrade</code> will. Crossing a suite boundary is neither of them — it is <code>do-release-upgrade</code>, and it needs a second way into the machine.",
      "Snap, Flatpak and Nix all refuse to share a mutable <code>/usr</code>, and each pays for it differently: snap in disk and daemon overhead, Flatpak in runtime duplication, Nix in store growth and concepts. On a headless VPS the answer is usually the one that adds the fewest daemons."
    ],
    glossary: {
      "deb": "A binary Debian package: an ar archive holding debian-binary, control.tar and data.tar, in that order.",
      "control.tar": "The metadata member of a .deb: the control file, md5sums, conffiles, the maintainer scripts, triggers and shlibs.",
      "conffiles": "The list of paths dpkg will not overwrite during an upgrade. An edited one is preserved and the new one arrives as .dpkg-new.",
      "ok installed": "The dpkg state string meaning unpacked, configured and triggers fired. The only fully healthy state.",
      "half-configured": "A package whose files are on disk but whose postinst failed. dpkg --configure -a retries it.",
      "unpacked": "The dpkg state after files are written but before postinst has run successfully.",
      "hold": "A per-package flag, stored as a pin priority of 1001, that makes apt refuse both upgrades and removal of that package.",
      "Pin-Priority": "The number apt sorts candidates by. 500 default, 100 for backports, above 1000 permits downgrades.",
      "InRelease": "An inline clear-signed Release file carrying the SHA256 of every index file in the suite.",
      "signed-by": "An apt sources.list option naming the exact keyring that may sign one repository, so trust is scoped to that stanza.",
      "NO_PUBKEY": "The gpg error meaning the keyring does not contain the key that signed the repository. The repository is then unusable, not merely untrusted.",
      "backports": "A suite archive holding packages built against the current release but not installed by default. Reached with priority 100 plus an explicit pkg/suite request.",
      "suite": "The set of packages for one point release or one cross-version archive. Crossing a suite boundary is a distribution upgrade, not an upgrade.",
      "full-upgrade": "An apt operation that may install new packages and remove existing ones to satisfy the dependency graph. Renamed from dist-upgrade in apt 1.1.",
      "deb822": "The multi-line sources format used in /etc/apt/sources.list.d/*.sources, which can carry its own Signed-By field. Supported since apt 1.1.",
      "ostree": "The content-addressed, atomically-updated filesystem repository storage that Flatpak uses for applications and runtimes.",
      "squashfs": "A compressed read-only filesystem image. Snap ships one per revision and mount it over a loop device, which is the source of snapd's disk and memory overhead.",
      "dnf history undo": "The only mainstream package-manager rollback, available because the rpmdb records enough state to reverse a transaction."
    }
  });
})();