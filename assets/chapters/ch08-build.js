/* ch08 — Building from source, linking, and packaging it */
(function () {
  LX.push({
    id: "build",
    title: "Building from source, linking, and packaging it",
    tagline: "Six stages between a text file and a running service — and a package manager that skips four of them.",
    sections: [
      {
        type: "prose",
        h: "The pipeline, and which stages a package skips",
        p: [
          "A C program is turned into a running process by five distinct transformations plus one copy. The stages are separate programs with separate jobs, and almost every build problem you will meet belongs to exactly one of them.",
          "<strong>Preprocess</strong> (<code>cpp</code>, folded into the compiler driver as <code>cc1 -E</code>) expands <code>#include</code>, resolves <code>#define</code> and <code>#ifdef</code>, and pastes in macro-expanded text. It does not understand C. Its failure mode is the one everybody knows: <code>fatal error: zlib.h: No such file or directory</code> means the preprocessor searched its include path and found nothing, not that the compiler is missing anything.",
          "<strong>Compile</strong> (<code>cc1</code>) parses and type-checks one translation unit and emits assembly. It still knows nothing about other files. Two translation units each calling <code>strlen</code> both emit a reference to an external symbol and neither emits its definition.",
          "<strong>Assemble</strong> (<code>as</code>) turns that assembly into an ELF relocatable object, <code>.o</code>. This is the first moment there is a file on disk, with sections (<code>.text</code>, <code>.rodata</code>, <code>.data</code>, <code>.bss</code>) and a symbol table full of undefined references.",
          "<strong>Link</strong> (<code>collect2</code> driving <code>ld</code>) reads every object and every <code>-l</code> library on the command line, matches each undefined symbol to a definition, allocates addresses, resolves relocations, and produces the final ELF executable or shared object. If a symbol nobody defines is still undefined at the end, you get <code>undefined reference to</code> — a link error, not a compile error, and the distinction matters because the compile already succeeded.",
          "<strong>Install</strong> is not a compiler stage. It is a copy, plus whatever the maintainer's script does: <code>install</code> with a mode, <code>ldconfig</code>, <code>update-alternatives</code>, a systemd unit symlink. It is the stage that touches paths, and it is the one that has to be redirected for packaging.",
          "Now the part that matters practically: <strong>which of these stages does a package run?</strong> A <code>.deb</code> that ships a Python script runs none of the first four — it ships the <code>.py</code> and the shebang does the rest. A binary package ships a fully linked ELF: the maintainer compiled, assembled and linked on their machine, and you run only the install stage. Which is exactly why the chain of trust in a repository is about the <em>package</em> and not about your compiler — you are trusting that someone else's compiler did the first four stages correctly, and that the fifth stage is the only one left for your machine to do."
        ]
      },
      {
        type: "diagram",
        h: "The five stages, and what each one is allowed to be wrong about",
        caption: "Run <code>gcc -### foo.c -o foo</code> to see the exact subprocess command lines without executing them, and <code>gcc -v</code> to see them with execution. The left column is what a package author does once; the right column is what you inherit when you <code>apt install</code> a binary package.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="Build pipeline from preprocess through compile, assemble, link and install, with a column showing what a binary package skips">
  <text class="t-title" x="40" y="34" font-size="17">gcc is a driver, not a compiler: it runs six programs and picks which</text>

  <rect class="box-v" x="40" y="52" width="230" height="96" rx="10"/>
  <text class="t-sm" x="58" y="78" font-size="15">1 · PREPROCESS</text>
  <text class="t-xs" x="58" y="100">cpp / cc1 -E</text>
  <text class="t-xs" x="58" y="118">#include, #define, #ifdef</text>
  <text class="t-xs" x="58" y="136">text in, text out</text>

  <path class="ln-a" d="M270,100 L322,100" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="326" y="52" width="230" height="96" rx="10"/>
  <text class="t-sm" x="344" y="78" font-size="15">2 · COMPILE</text>
  <text class="t-xs" x="344" y="100">cc1</text>
  <text class="t-xs" x="344" y="118">parse, type-check, optimise</text>
  <text class="t-xs" x="344" y="136">C in, assembly out</text>

  <path class="ln-a" d="M556,100 L608,100" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="612" y="52" width="230" height="96" rx="10"/>
  <text class="t-sm" x="630" y="78" font-size="15">3 · ASSEMBLE</text>
  <text class="t-xs" x="630" y="100">as</text>
  <text class="t-xs" x="630" y="118">ELF relocatable object</text>
  <text class="t-xs" x="630" y="136">the first file on disk</text>

  <path class="ln-a" d="M842,100 L894,100" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="898" y="52" width="162" height="96" rx="10"/>
  <text class="t-sm" x="916" y="78" font-size="15">4 · LINK</text>
  <text class="t-xs" x="916" y="100">collect2 → ld</text>
  <text class="t-xs" x="916" y="118">resolve symbols,</text>
  <text class="t-xs" x="916" y="136">emit PT_INTERP</text>

  <path class="ln" d="M742,148 L742,176" marker-end="url(#lm-arrow)"/>

  <rect class="box-p" x="612" y="180" width="230" height="80" rx="10"/>
  <text class="t-sm" x="630" y="206" font-size="15">5 · INSTALL</text>
  <text class="t-xs" x="630" y="228">install -m755 → $DESTDIR$prefix/bin</text>
  <text class="t-xs" x="630" y="248">ldconfig, alternatives, unit symlinks</text>

  <!-- object detail -->
  <rect class="box" x="40" y="288" width="470" height="200" rx="11"/>
  <text class="t-sm" x="58" y="314" font-size="15">what an object file actually contains</text>
  <text class="t-xs" x="58" y="340">readelf -S foo.o
  [ 1] .text          PROGBITS  the machine code, RX
  [ 3] .rodata        PROGBITS  string literals, jump tables, R
  [ 6] .data          PROGBITS  initialised globals, RW
  [ 8] .bss           NOBITS    zeroed at load time, no file bytes, RW
  [12] .debug_info    PROGBITS  DWARF line table — only with -g
  [18] .rela.text     RELA      "fix up this offset relative to this symbol"</text>
  <text class="t-xs" x="58" y="400">nm foo.o
  0000000000000000 T main                 defined here, global
  0000000000000018 t helper               defined here, local
                         U printf           declared, defined elsewhere
  0000000000000030 B counter              in .bss, zero bytes on disk</text>
  <text class="t-xs" x="58" y="452">every U is a promise the linker has to keep. An unkept promise is</text>
  <text class="t-xs" x="58" y="472">"undefined reference to 'printf'" — with the first library that was not found.</text>

  <!-- what a package skips -->
  <rect class="box-b" x="532" y="288" width="528" height="200" rx="11"/>
  <text class="t-bad" x="550" y="314" font-size="15">what apt install actually runs</text>
  <text class="t-xs" x="550" y="340">apt install nginx   →   dpkg -i nginx_1.14.0-2ubuntu3.5_amd64.deb</text>
  <text class="t-xs" x="550" y="362">stage 1  PREPROCESS      not run — the .o is already inside the package</text>
  <text class="t-xs" x="550" y="384">stage 2  COMPILE         not run</text>
  <text class="t-xs" x="550" y="406">stage 3  ASSEMBLE        not run</text>
  <text class="t-xs" x="550" y="428">stage 4  LINK            not run — but see the loader diagram, because</text>
  <text class="t-xs" x="546" y="446">                          dynamic symbols are resolved at RUN time instead</text>
  <text class="t-xs" x="550" y="470">stage 5  INSTALL         this one runs on your machine, and it is</text>
  <text class="t-xs" x="550" y="488">                          the only stage you can audit from the package</text>

  <rect class="box" x="40" y="512" width="1020" height="126" rx="10"/>
  <text class="t-sm" x="58" y="538" font-size="15">the same five stages for the other kinds of payload</text>
  <text class="t-xs" x="58" y="562">a shell or perl script in a .deb: zero compiler stages. install copies it to /usr/bin, sets the mode, done.</text>
  <text class="t-xs" x="58" y="584">a Python package in a .deb: stages 1–4 run on YOUR machine at apt install time, byte-compiled by dpkg's</text>
  <text class="t-xs" x="58" y="602">byte-compilation step. That is the one case where an untrusted package really does execute on your box.</text>
  <text class="t-xs" x="58" y="626">a byte-compiled bytecode file in a .deb: no stages. The interpreter does 1–2 at run time instead.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "The loader is the stage you skipped",
        p: [
          "When <code>ld</code> produces a dynamically linked executable it does not resolve everything. It resolves the symbols it can from the objects and archives you gave it, records what is still missing in a <code>.dynsym</code> table, and writes a list of shared objects it wants into the dynamic section as <code>DT_NEEDED</code> entries. <code>printf</code> is one of those, because printf lives in <code>libc.so.6</code> and the linker had no reason to inline it.",
          "At run time the kernel maps the executable, reads <code>PT_INTERP</code>, which names the dynamic loader (<code>/lib64/ld-linux-x86-64.so.2</code> on x86-64 glibc), maps that too, and jumps to the executable's entry point — which on a dynamically linked binary is not <code>main</code>, it is <code>_start</code>, which immediately calls into the loader. The loader then finds each <code>DT_NEEDED</code> object, resolves the remaining symbols, applies the relocations the linker could not, and calls <code>main</code>.",
          "The consequence worth internalising: <strong>linking happens twice, and the second time is on your machine</strong>. The first is a static bookkeeping operation at build time; the second is the real one, and it is the reason a binary can be perfectly well-linked and still fail to start with <code>error while loading shared libraries: libfoo.so.1: cannot open shared object file</code>. That message comes from <code>ld.so</code>, not from the kernel, and it is about the third-party library you removed two weeks ago — not about anything in the package you are running."
        ]
      },
      {
        type: "diagram",
        h: "Compile, link, load: the same three libraries, three different jobs",
        caption: "Follow one symbol, <code>memcpy</code>, through all three phases. At link time it becomes an undefined reference that <code>libc.so</code> is expected to satisfy. At load time <code>ld.so</code> actually goes and finds it. When a package upgrade changes <code>libc.so.6</code> underneath a running binary, the loader has already finished and is not consulted again — which is why the old process keeps running on pages that no longer have a name.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="The chain from source file through compiler and linker to the binary, then through the kernel, the dynamic loader and libc at run time">
  <!-- build time -->
  <rect class="box" x="40" y="24" width="1020" height="272" rx="11"/>
  <text class="t-sm" x="58" y="50" font-size="15">BUILD TIME — on the maintainer's machine, once</text>

  <rect class="box-v" x="58" y="64" width="180" height="56" rx="8"/>
  <text class="t-sm" x="72" y="90">nginx -c main.c</text>
  <text class="t-xs" x="72" y="110">the translation unit</text>

  <path class="ln-a" d="M238,92 L286,92" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="290" y="64" width="200" height="56" rx="8"/>
  <text class="t-sm" x="304" y="90">cc1 → main.o</text>
  <text class="t-xs" x="304" y="110">undefined refs recorded</text>

  <path class="ln-a" d="M490,92 L538,92" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="542" y="64" width="200" height="56" rx="8"/>
  <text class="t-sm" x="556" y="90">as → main.o</text>
  <text class="t-xs" x="556" y="110">sections + symtab</text>

  <path class="ln-a" d="M742,92 L790,92" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="794" y="64" width="248" height="56" rx="8"/>
  <text class="t-sm" x="808" y="90">ld → nginx (ELF)</text>
  <text class="t-xs" x="808" y="110">resolves what it can</text>

  <text class="t-xs" x="58" y="150">what ld could NOT resolve, and why it is allowed to leave them:</text>
  <rect class="box-p" x="58" y="162" width="200" height="46" rx="7"/>
  <text class="t-sm" x="72" y="184">memcpy</text>
  <text class="t-xs" x="72" y="202">left undefined on purpose</text>

  <rect class="box-p" x="270" y="162" width="200" height="46" rx="7"/>
  <text class="t-sm" x="284" y="184">pcre_compile2</text>
  <text class="t-xs" x="284" y="202">left undefined on purpose</text>

  <rect class="box-p" x="482" y="162" width="200" height="46" rx="7"/>
  <text class="t-sm" x="496" y="184">SSL_CTX_new</text>
  <text class="t-xs" x="496" y="202">left undefined on purpose</text>

  <path class="ln-p" d="M158,208 L158,236" marker-end="url(#lm-arrow)"/>
  <path class="ln-p" d="M370,208 L370,236" marker-end="url(#lm-arrow)"/>
  <path class="ln-p" d="M582,208 L582,236" marker-end="url(#lm-arrow)"/>

  <rect class="box-v" x="58" y="240" width="200" height="42" rx="7"/>
  <text class="t-xs" x="72" y="266">DT_NEEDED libc.so.6</text>
  <rect class="box-v" x="270" y="240" width="200" height="42" rx="7"/>
  <text class="t-xs" x="284" y="266">DT_NEEDED libpcre.so.1</text>
  <rect class="box-v" x="482" y="240" width="200" height="42" rx="7"/>
  <text class="t-xs" x="496" y="266">DT_NEEDED libssl.so.1.1</text>

  <text class="t-warn" x="700" y="266" font-size="14">the linker produced a file that cannot</text>
  <text class="t-warn" x="700" y="286" font-size="14">start on its own. This is normal and</text>
  <text class="t-warn" x="700" y="306" font-size="14">it is what "dynamic linking" means.</text>

  <!-- run time -->
  <rect class="box" x="40" y="320" width="1020" height="292" rx="11"/>
  <text class="t-sm" x="58" y="346" font-size="15">RUN TIME — on your machine, every single execution</text>

  <rect class="box-b" x="58" y="360" width="180" height="52" rx="8"/>
  <text class="t-sm" x="72" y="382">kernel: execve</text>
  <text class="t-xs" x="72" y="402">maps nginx, reads PT_INTERP</text>

  <path class="ln-b" d="M238,386 L286,386" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-p" x="290" y="360" width="220" height="52" rx="8"/>
  <text class="t-sm" x="304" y="382">_start, not main</text>
  <text class="t-xs" x="304" y="402">control goes to ld.so first</text>

  <path class="ln-b" d="M510,386 L558,386" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-p" x="562" y="360" width="220" height="52" rx="8"/>
  <text class="t-sm" x="576" y="382">ld-linux-x86-64.so.2</text>
  <text class="t-xs" x="576" y="402">searches DT_NEEDED, in order</text>

  <path class="ln-b" d="M782,386 L830,386" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-ok" x="834" y="360" width="208" height="52" rx="8"/>
  <text class="t-sm" x="848" y="382">main()</text>
  <text class="t-xs" x="848" y="402">only now</text>

  <rect class="box" x="58" y="428" width="984" height="80" rx="9"/>
  <text class="t-sm" x="76" y="452" font-size="14">the search order ld.so uses for every DT_NEEDED name — stop at the first hit</text>
  <text class="t-xs" x="76" y="474">1. DT_RPATH of the loading object, only if it has no DT_RUNPATH · 2. $LD_LIBRARY_PATH · 3. DT_RUNPATH of the loading object</text>
  <text class="t-xs" x="76" y="494">4. /etc/ld.so.cache, built by ldconfig from /etc/ld.so.conf and /etc/ld.so.conf.d/*.conf · 5. /lib/x86_64-linux-gnu, /usr/lib/x86_64-linux-gnu, /lib, /usr/lib</text>

  <rect class="box-w" x="58" y="522" width="484" height="80" rx="9"/>
  <text class="t-sm" x="76" y="546" font-size="14">the upgrade-under-a-running-binary question</text>
  <text class="t-xs" x="76" y="568">dpkg installs the new libfoo.so.1.2.4 as a NEW inode and renames it into place. The running</text>
  <text class="t-xs" x="76" y="590">process still has the old inode mapped and keeps running perfectly. That is safe.</text>

  <rect class="box-b" x="558" y="522" width="484" height="80" rx="9"/>
  <text class="t-sm" x="576" y="546" font-size="14">what is not safe</text>
  <text class="t-xs" x="576" y="568">Truncating the file in place — dd conv=notrunc, a hand-rolled install, a bad tar extraction —</text>
  <text class="t-xs" x="576" y="590">keeps the inode and rewrites its pages: every process using it dies with SIGBUS instantly.</text>

  <text class="t-dim" x="40" y="640" font-size="14">Corollary: a process that has finished loading will never re-consult ld.so for a library it already bound. dlopen() after the fact will,</text>
  <text class="t-dim" x="40" y="662" font-size="14">which is why a long-running daemon can pick up a newly installed plugin and crash inside it.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "See exactly which programs the compiler driver runs, and what the linker produced",
        code: `# what gcc is actually going to execute, without executing it
$ gcc -### -O2 -o hello hello.c 2>&1 | tail -6
 /usr/lib/gcc/x86_64-linux-gnu/7/cc1 -quiet -imultiarch ... -o hello.s -x c hello.c
 /usr/bin/as --64 -o hello.o hello.s
 /usr/lib/gcc/x86_64-linux-gnu/7/collect2 -plugin ... -m elf_x86_64 ... -o hello \
     /usr/lib/gcc/x86_64-linux-gnu/7/crtbegin.o -L... -lgcc --as-needed -lgcc_s \
     --no-as-needed -lc -lgcc ... /usr/lib/gcc/x86_64-linux-gnu/7/crtend.o -lc -lgcc ...
#   crtbegin.o / crtend.o are the C runtime bits that run before and after main()
#   --as-needed is on by default on Ubuntu: a -l whose symbols were already satisfied is
#   dropped from DT_NEEDED. That is why "I linked -lssl but it is not in DT_NEEDED" happens.

$ gcc -v -o hello hello.c        # the same, with the exec lines

# what the linker left unresolved, and what it recorded instead
$ readelf -d hello | head
 0x0000000000000001 (NEEDED)   Shared library: [libc.so.6]
 0x0000000000000001e (RUNPATH) Library runpath: [/usr/local/lib]

# ldd runs the binary with LD_TRACE_LOADED_OBJECTS=1 — do not point it at anything untrusted.
# readelf is the safe way and gives you more:
$ readelf -d ./hello | grep NEEDED
$ readelf -h ./hello | grep -i interpreter
  [Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]

# is it actually static?
$ file ./hello
ELF 64-bit LSB pie executable, x86-64, dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2
$ ldd ./hello
	linux-vdso.so.1 (0x00007ffd...)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f2a...)
$ ldd ./static-hello
	not a dynamic executable

# the sections, and how big each stage made them
$ size ./hello
   text	   data	    bss	    dec	    hex	filename
  1657	    16	   8	   1681	    691	./hello`
      },
      {
        type: "prose",
        h: "Autotools: configure is a program that configures a program",
        p: [
          "The autotools stack is three programs that generate other programs. <code>autoconf</code> generates <code>configure</code> from <code>configure.ac</code>. <code>automake</code> generates <code>Makefile.in</code> from <code>Makefile.am</code>. <code>libtool</code> generates the machinery that builds, relinks and installs shared libraries portably. None of them ship in a release tarball as generated output — you get <code>configure</code> and <code>Makefile.in</code>, and the maintainer runs <code>autoreconf -vfi</code> to regenerate them when patching.",
          "<strong>What configure actually is:</strong> a 500 kB shell script that probes your machine. It compiles dozens of tiny test programs, runs them, inspects the results, and writes <code>config.status</code> and <code>config.log</code>. This matters when it fails: the answer is in <code>config.log</code>, not in the error message, and searching for the word <code>error</code> in it will usually not find the useful line — you want the last few hundred lines, or to look for the specific probe. <code>config.log</code> records every compiler invocation verbatim, which makes it the single most useful file in any autotools build failure.",
          "The cache is the second thing to understand. <code>./configure</code> writes its conclusions into <code>config.cache</code> (only if you pass <code>-C</code> or set it) and into <code>config.status</code>, and re-running configure re-runs every probe unless the cache is current. The modern recommendation is <code>./configure ... &amp;&amp; ./config.status</code>, and the standard recommendation for CMake's equivalent problem is <code>rm -rf build</code>, because a stale cache is the single most common source of 'it works for them and not for me'.",
          "Now the flags, and they matter more than anything else in this chapter because <code>--prefix</code> alone is almost always wrong for a packaged install."
        ]
      },
      {
        type: "table",
        cols: ["Flag", "Default", "Why it matters for a .deb"],
        rows: [
          ["<code>--prefix=DIR</code>", "<code>/usr/local</code>", "The single most consequential flag. For a package it should be <code>/usr</code>, because <code>/usr/local</code> is by FHS policy for locally-installed software that the packaging system does not own. <code>make install</code> with <code>--prefix=/usr/local</code> on Debian puts the package's files outside dpkg's ownership entirely: no <code>dpkg -L</code>, no verification, no uninstall, and they survive an image rebuild as a mystery."],
          ["<code>--bindir</code> <code>--libdir</code> <code>--sbindir</code>", "<code>$prefix/bin</code> etc.", "Under <code>--prefix=/usr</code> these are usually right, but <code>--libdir</code> is not: Debian policy wants <code>/usr/lib/&lt;triplet&gt;</code> on a multiarch system. Get the triplet from <code>dpkg-architecture -qDEB_HOST_MULTIARCH</code>, or read it out of <code>/usr/lib/&lt;something&gt;</code> rather than hardcoding it."],
          ["<code>--sysconfdir</code>", "<code>$prefix/etc</code>", "With <code>--prefix=/usr</code> this becomes <code>/usr/etc</code>, which is wrong under both Debian policy and FHS. Always pass <code>--sysconfdir=/etc</code>. This is the most common single-flag omission in a hand-rolled package."],
          ["<code>--localstatedir</code>", "<code>$prefix/var</code>", "Same trap, worse consequence: <code>/usr/var/lib/foo</code> is outside <code>/var</code>, so logrotate and journald do not see it, tmpfiles does not clean it, and it does not disappear on a state-dir reset. Always <code>--localstatedir=/var</code>."],
          ["<code>--datarootdir</code> <code>--datadir</code>", "<code>$prefix/share</code>", "Use <code>--datarootdir=/usr/share</code>. Debian further wants <code>--docdir=/usr/share/doc/$PACKAGE</code>, and licence files under <code>/usr/share/doc/$PACKAGE</code>."],
          ["<code>--localedir</code>", "<code>$prefix/share/locale</code>", "<code>--localedir=/usr/share/locale</code>. Under a non-system prefix, gettext's catalogue lookup silently finds nothing and programs fall back to untranslated strings."],
          ["<code>--with-FEATURE[=ARG]</code>", "unset", "Enables an optional subsystem. Note the asymmetry: <code>--with</code> defaults to yes and <code>--without</code> to no for many packages, while <code>--enable</code> defaults to yes and <code>--disable</code> to no. Passing <code>--with-foo</code> when the package wants <code>--enable-foo</code> silently does nothing at all."],
          ["<code>--disable-FEATURE</code>", "varies", "The two that pay for themselves on every build: <code>--disable-dependency-tracking</code> turns off the automake-generated rebuild-if-config.h-changed machinery, which on a small VM removes hundreds of pointless rebuilds; and <code>--disable-silent-rules</code> makes <code>make</code> print the compiler command lines, which turns a silent four-minute stall into a visible one-line compile."],
          ["<code>--enable-static --disable-shared</code>", "shared on, static off", "Linking both doubles the build time. For a test build, <code>--disable-shared</code> also avoids libtool's relink step, which is a real annoyance when building as a non-root user with <code>--prefix=/usr</code>."],
          ["<code>--srcdir</code> / out-of-tree", "in-tree", "Building in a separate directory (<code>mkdir build &amp;&amp; cd build &amp;&amp; ../configure</code>) is mandatory for anyone doing packaging, because the source tree stays pristine and you can build several configurations at once. Any patch step in <code>debian/rules</code> becomes safe to re-run."],
          ["<code>--host</code> <code>--build</code>", "guessed", "<code>--build</code> is the machine doing the building, <code>--host</code> is the machine that will run the result. For a cross compile you pass <code>--host=aarch64-linux-gnu</code>. The confused part: for a <em>cross compiler</em> you would pass <code>--target</code>. See the cross-compilation section."],
          ["<code>--cache-file</code>", "<code>config.cache</code>", "Rarely what you want. If <code>configure</code> behaves differently on the second run, this is why."]
        ]
      },
      {
        type: "diagram",
        h: "What configure writes down, and where each answer is consumed",
        caption: "<code>configure</code> produces three artefacts and every packaging bug traces back to one of them being wrong. <code>config.log</code> is the record of the probes — when configure fails, the useful line is in there and not in the error message. <code>config.status</code> is the recipe: the exact argv plus every path it will install to, which is what a <code>debian/rules</code> override targets. And <code>config.h</code> is the compiled-in answer, which is why <code>#ifdef</code> behaviour in the binary can contradict what you think you configured.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="The three files configure produces and what consumes each one">
  <rect class="box-v" x="40" y="24" width="200" height="76" rx="10"/>
  <text class="t-sm" x="58" y="50" font-size="15">./configure</text>
  <text class="t-xs" x="58" y="72">~120 probe programs:</text>
  <text class="t-xs" x="58" y="90">compile, run, inspect</text>

  <path class="ln-v" d="M240,62 L286,62" marker-end="url(#lm-arrow)"/>

  <rect class="box-a" x="290" y="24" width="240" height="76" rx="10"/>
  <text class="t-sm" x="308" y="50" font-size="15">config.log</text>
  <text class="t-xs" x="308" y="72">every command line, every</text>
  <text class="t-xs" x="308" y="90">result, in order. THE file</text>

  <path class="ln-a" d="M530,62 L576,62" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="580" y="24" width="230" height="76" rx="10"/>
  <text class="t-ok" x="598" y="50" font-size="15">config.status</text>
  <text class="t-xs" x="598" y="72">a shell script holding</text>
  <text class="t-xs" x="598" y="90">every install path</text>

  <path class="ln-ok" d="M810,62 L856,62" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box" x="860" y="24" width="200" height="76" rx="10"/>
  <text class="t-sm" x="878" y="50" font-size="15">config.h</text>
  <text class="t-xs" x="878" y="72">#define HAVE_X 1</text>
  <text class="t-xs" x="878" y="90">compiled into the binary</text>

  <!-- consumers -->
  <path class="ln-a" d="M370,100 L370,146" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="230" y="150" width="280" height="96" rx="10"/>
  <text class="t-accent" x="248" y="176" font-size="14">you, reading it</text>
  <text class="t-xs" x="248" y="198">$ grep -n "conftest" config.log | tail -40</text>
  <text class="t-xs" x="248" y="216">$ ./config.status --config</text>
  <text class="t-xs" x="248" y="238">the answer to "why did configure</text>
  <text class="t-xs" x="248" y="240">"  is in the log, not on stderr</text>

  <path class="ln-ok" d="M695,100 L695,146" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="550" y="150" width="290" height="96" rx="10"/>
  <text class="t-ok" x="568" y="176" font-size="14">Makefile.in → Makefile</text>
  <text class="t-xs" x="568" y="198">$(prefix) $(libdir) $(sysconfdir)</text>
  <text class="t-xs" x="568" y="216">$(localstatedir) become variables here</text>
  <text class="t-xs" x="568" y="238">this is where DESTDIR is prepended</text>

  <path class="ln" d="M960,100 L960,146" marker-end="url(#lm-arrow)"/>
  <rect class="box" x="850" y="150" width="210" height="96" rx="10"/>
  <text class="t-sm" x="868" y="176" font-size="14">#ifdef in the source</text>
  <text class="t-xs" x="868" y="198">frozen at compile time</text>
  <text class="t-xs" x="868" y="216">a later --sysconfdir= will</text>
  <text class="t-xs" x="868" y="238">NOT change it. rebuild.</text>

  <!-- the trap -->
  <rect class="box-b" x="40" y="286" width="1020" height="150" rx="11"/>
  <text class="t-bad" x="58" y="312" font-size="15">the trap: config.h is not regenerated when a flag changes</text>
  <text class="t-xs" x="58" y="338">configure with --sysconfdir=/etc, build, then re-run configure with --sysconfdir=/usr/etc.</text>
  <text class="t-xs" x="58" y="360">The Makefile paths change. The #define HAVE_SYSCONFDIR does not, because config.h is only rewritten when its inputs</text>
  <text class="t-xs" x="58" y="378">actually differ, and automake's dependency tracking is what decides that. Automake added --disable-dependency-tracking</text>
  <text class="t-xs" x="58" y="400">precisely so this loop would be fast; the trade is that a stale config.h is now cheap to produce and</text>
  <text class="t-xs" x="58" y="418">silent. The fix is not a flag, it is a clean tree: rm -rf build, every time.</text>

  <rect class="box" x="40" y="462" width="1020" height="132" rx="11"/>
  <text class="t-sm" x="58" y="488" font-size="15">the four questions to ask config.status, in this order</text>
  <text class="t-xs" x="58" y="512">1 · ./config.status --config          →  the exact argv, which is what you paste into debian/rules</text>
  <text class="t-xs" x="58" y="534">2 · ./config.status --prefix          →  /usr/local if you forgot it. Check this before you ever run make install.</text>
  <text class="t-xs" x="58" y="556">3 · grep -E '^(prefix|sysconfdir|localstatedir|libdir)=' config.status</text>
  <text class="t-xs" x="58" y="578">4 · grep '^#define' config.h | grep -v '^#define PACKAGE'   →  the frozen answers the binary was built with</text>
</svg>
`
      },
      {
        type: "diagram",
        h: "Two different searches: the linker's and the loader's",
        caption: "The linker's job is to find a <em>file</em> to open, using only <code>-L</code> paths and the compile-time default directories — <code>ldconfig</code> and <code>LD_LIBRARY_PATH</code> are not consulted. The loader's job is to find a file for a name already baked into <code>DT_NEEDED</code>, and it consults both. Confusing the two produces two different failure modes with the same message, and the right fix is different in each case: install the <code>-dev</code> package for a link-time miss, install the runtime package for a run-time miss.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="Side by side comparison of linker search paths and dynamic loader search paths">
  <text class="t-title" x="40" y="34" font-size="17">link time</text>
  <text class="t-title" x="560" y="34" font-size="17">run time</text>

  <!-- LINKER -->
  <rect class="box-a" x="40" y="46" width="500" height="270" rx="11"/>
  <text class="t-accent" x="58" y="72" font-size="15">ld — looking for libfoo.so, for the -lfoo you typed</text>
  <text class="t-xs" x="58" y="96">1 · -L paths, in the order you wrote them</text>
  <text class="t-xs" x="58" y="118">2 · the directories baked into ld at build time</text>
  <text class="t-xs" x="58" y="138">3 · nothing else. no ldconfig. no LD_LIBRARY_PATH.</text>

  <rect class="box-ok" x="58" y="152" width="464" height="52" rx="8"/>
  <text class="t-sm" x="74" y="176">the file it wants is libfoo.so — the UNVERSIONED symlink</text>
  <text class="t-xs" x="74" y="196">that symlink lives in libfoo-dev. libfoo.so.1.2.3 alone is not enough.</text>

  <rect class="box-b" x="58" y="216" width="464" height="52" rx="8"/>
  <text class="t-bad" x="74" y="240">/usr/bin/ld: cannot find -lfoo</text>
  <text class="t-xs" x="74" y="260">fix: apt install libfoo-dev   —   ldconfig cannot help, the file is not there</text>

  <rect class="box-w" x="58" y="280" width="464" height="26" rx="6"/>
  <text class="t-xs" x="74" y="298">ld also runs --as-needed by default here: unused -lfoo is silently dropped</text>

  <!-- LOADER -->
  <rect class="box-v" x="560" y="46" width="500" height="270" rx="11"/>
  <text class="t-violet" x="578" y="72" font-size="15">ld.so — looking for libfoo.so.1, a DT_NEEDED entry</text>
  <text class="t-xs" x="578" y="96">1 · DT_RPATH, only if there is no DT_RUNPATH</text>
  <text class="t-xs" x="578" y="118">2 · $LD_LIBRARY_PATH</text>
  <text class="t-xs" x="578" y="138">3 · DT_RUNPATH — not inherited by dependencies</text>
  <text class="t-xs" x="578" y="158">4 · /etc/ld.so.cache, hashed, from ldconfig</text>
  <text class="t-xs" x="578" y="178">5 · the default dirs baked into glibc itself</text>

  <rect class="box-ok" x="578" y="192" width="464" height="34" rx="8"/>
  <text class="t-sm" x="594" y="214">found in the cache → mapped, symbols bound, relocations applied</text>

  <rect class="box-b" x="578" y="238" width="464" height="68" rx="8"/>
  <text class="t-bad" x="594" y="262">./myprog: error while loading shared libraries:</text>
  <text class="t-bad" x="594" y="282">  libfoo.so.1: cannot open shared object file: No such file</text>
  <text class="t-xs" x="594" y="300">fix: apt install libfoo1   —   or, if it is already installed somewhere odd, ldconfig</text>

  <!-- comparison band -->
  <rect class="box" x="40" y="342" width="1020" height="290" rx="11"/>
  <text class="t-sm" x="58" y="368" font-size="15">the same symptom, two different worlds</text>

  <rect class="box-a" x="58" y="382" width="484" height="112" rx="9"/>
  <text class="t-accent" x="74" y="406" font-size="14">make-time: cannot find -lfoo</text>
  <text class="t-xs" x="74" y="430">symptom  linker error, no binary produced</text>
  <text class="t-xs" x="74" y="452">cause    no libfoo.so symlink on any -L path</text>
  <text class="t-xs" x="74" y="474">fix      install libfoo-dev (or add -L/path)</text>
  <text class="t-xs" x="74" y="488">never fix it with LD_LIBRARY_PATH — ld does not read it</text>

  <rect class="box-p" x="560" y="382" width="484" height="112" rx="9"/>
  <text class="t-bad" x="576" y="406" font-size="14">run-time: error while loading shared libraries</text>
  <text class="t-xs" x="576" y="430">symptom  the binary exists and exits non-zero immediately</text>
  <text class="t-xs" x="576" y="452">cause    no libfoo.so.1 anywhere in the loader's 5-step search</text>
  <text class="t-xs" x="576" y="474">fix      install libfoo1, or ldconfig if the dir is already in ld.so.conf.d</text>
  <text class="t-xs" x="576" y="488">never fix it with -dev: it has a different SONAME entirely</text>

  <text class="t-warn" x="58" y="524" font-size="15">the one-line diagnostic that distinguishes them</text>
  <text class="t-xs" x="58" y="548">ldd ./myprog 2&gt;&amp;1 | grep 'not found'      →  a run-time miss: install the RUNTIME package</text>
  <text class="t-xs" x="58" y="570">ld -lfoo --verbose 2&gt;&amp;1 | grep 'cannot find' →  a link-time miss: install the -DEV package</text>
  <text class="t-xs" x="58" y="594">and the trap: dpkg -S /usr/lib/x86_64-linux-gnu/libfoo.so.1.2.3 points at the runtime package, not -dev. The .so symlink and</text>
  <text class="t-xs" x="58" y="614">the .pc file both live in -dev. That is the whole reason "it was installed but the build still fails" happens.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "A correct autotools build for this machine, out of tree, with the flags Debian packaging actually wants",
        code: `# 1. the toolchain
$ sudo apt-get install build-essential autoconf automake libtool pkg-config
#    build-essential = dpkg-dev, gcc, g++, make, libc6-dev
#    it is a meta-package; installing it is the right answer and inspecting it is not useful

# 2. get the multiarch triplet from the packaging system rather than hardcoding it
$ dpkg-architecture -qDEB_HOST_MULTIARCH
x86_64-linux-gnu
$ export DEB_BUILD_MAINT_OPTIONS=hardening=+all

# 3. the flags dpkg-buildflags would give you, and why each is there
$ dpkg-buildflags --get CPPFLAGS
-D_FORTIFY_SOURCE=2
$ dpkg-buildflags --get CFLAGS
-g -O2 -ffile-prefix-map=$PWD=. -fstack-protector-strong -fPIE
$ dpkg-buildflags --get LDFLAGS
-Wl,-z,relro -Wl,-z,now          # full RELRO: GOT is read-only after startup
$ dpkg-buildflags --get PKG_CONFIG_PATH
/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig

# 4. out of tree, with the flags that matter
$ mkdir -p build && cd build
$ ../configure \\
    --prefix=/usr \\
    --libdir=/usr/lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH) \\
    --sysconfdir=/etc \\
    --localstatedir=/var \\
    --datarootdir=/usr/share \\
    --localedir=/usr/share/locale \\
    --docdir=/usr/share/doc/mypkg \\
    --disable-dependency-tracking \\
    --disable-silent-rules \\
    --enable-shared --disable-static

# 5. what you can inspect when something goes wrong
$ grep -n "conftest" ../config.log | tail -40
$ ../config.status --config          # the exact argv configure was given
$ grep '^#define' config.h           # what the probes decided

# 6. build and install into a staging root, never into /
$ make -j"$(nproc)"                  # on 2 GB of RAM, nproc, not unlimited
$ make DESTDIR="$PWD/../stage" install
$ find ../stage -type f | head
../stage/usr/bin/mypkg
../stage/usr/lib/x86_64-linux-gnu/libmypkg.so.0.1.0
../stage/etc/mypkg.conf
../stage/var/log/mypkg/.keep         # note: /var/log here, NOT /usr/var/log`
      },
      {
        type: "callout",
        kind: "warn",
        title: "The libtool relink trap, and why it is not your fault",
        text: "Configure with <code>--prefix=/usr</code> as a non-root user and <code>make</code> can fail with <code>libtool: error: failed to create temporary file '/usr/lib/#inst#12345'</code> or <code>cannot install 'libfoo.la'</code>. This is libtool's 'fast install' relink step: to compute the final paths of shared libraries without installing anything, it relinks them into <code>$libdir</code> during the build. With a prefix you do not own, it cannot. The reliable answers are to build out of tree with <code>--disable-shared</code> for a test run, to pass <code>relink=no</code> to <code>configure</code> where the package supports it, or to build inside a container where you are root. It is a libtool design wart, not a broken checkout, and chasing it in the Makefile wastes an afternoon."
      },
      {
        type: "prose",
        h: "make -j, make install, and why DESTDIR is the whole ballgame",
        p: [
          "<code>make -j$(nproc)</code> parallelises by building the dependency DAG out of order and only serialising where a declared dependency says so. It is only as correct as the Makefile's dependency declarations: a rule that is missing a prerequisite will now race, where sequentially it merely happened to work. Recursive make is the other classic hazard — GNU make knows to serialise sub-makes by passing the jobserver down, but hand-rolled shell loops inside a rule do not. <code>.NOTPARALLEL:</code> and <code>.WAIT</code> (make 4.4, 2020) exist for these cases.",
          "On a 2 GB machine, unbounded <code>-j</code> is a real risk. A single C++ translation unit in a large project can peak above 1 GB of resident memory in <code>cc1plus</code>; four of those in parallel is an OOM kill, and the OOM killer's choice of victim is not always the compiler. <code>-j$(nproc)</code> is the right default, <code>-j2</code> when memory is tighter, and when a build dies with no error message check <code>dmesg -T | tail</code> for <code>Out of memory: Killed process … cc1plus</code> before you go looking for a compiler bug.",
          "<strong>DESTDIR</strong> is the mechanism that makes packaging possible at all. It is a staging root prefixed to every installation path, applied at install time only. <code>make DESTDIR=/tmp/stage install</code> writes <code>/tmp/stage/usr/bin/mypkg</code> instead of <code>/usr/bin/mypkg</code>. Nothing in the Makefile knows the difference: the same variable expansion produces a path, and the prefix is simply there. That is the entire trick, and it has three consequences worth stating explicitly.",
          "First, you can build a package as an unprivileged user, with no root on the machine, with no chance of overwriting the running system's files. Second, <code>dpkg-deb</code> consumes exactly that staged tree: <code>DEBIAN/</code> beside <code>usr/</code>, <code>etc/</code>, <code>var/</code>, and <code>dpkg-deb --build</code> packages it. Third, <code>DESTDIR</code> is <em>not</em> a chroot and does not change what the program believes at run time. A program whose <code>sysconfdir</code> was compiled in as <code>/usr/etc</code> will look for <code>/usr/etc</code> on the real machine no matter what you staged it into, and the file will be in the package under the wrong path. DESTDIR cannot fix a wrong <code>--sysconfdir</code>; only the configure flag can.",
          "A fourth thing DESTDIR does not do: it does not run <code>ldconfig</code> for you, and it does not create the <code>/etc/systemd/system</code> symlinks a service package needs. Those are maintainer-script jobs, which is why <code>postinst</code> exists and why <code>debian/rules</code> in a modern package is a dozen lines of <code>dh $@</code> rather than a hand-written script."
        ]
      },
      {
        type: "diagram",
        h: "DESTDIR: two roots, one Makefile",
        caption: "The same variable expansion reaches two different roots. What changes between the two executions is only the value of <code>DESTDIR</code>, which is why a staged build is bit-identical to a real one and why <code>make install DESTDIR=…</code> and <code>make DESTDIR=… install</code> are the same thing. The third column is the trap: a path compiled <em>into</em> the binary is not a variable expansion and no amount of DESTDIR will move it.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Two install roots reached from the same Makefile variable, and the paths that DESTDIR cannot redirect">
  <rect class="box-v" x="40" y="24" width="270" height="120" rx="10"/>
  <text class="t-sm" x="58" y="50" font-size="15">the Makefile</text>
  <text class="t-xs" x="58" y="74">bin_PROGRAMS = mypkg</text>
  <text class="t-xs" x="58" y="94">install-binPROGRAMS:</text>
  <text class="t-xs" x="58" y="112">  $(INSTALL) -m 755 mypkg</text>
  <text class="t-xs" x="58" y="130">    $(DESTDIR)$(bindir)/mypkg</text>

  <path class="ln-a" d="M310,60 L430,60" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="370" y="48" font-size="14" text-anchor="middle">make install</text>
  <text class="t-accent" x="370" y="112" font-size="12" text-anchor="middle">DESTDIR unset</text>

  <path class="ln-a" d="M310,110 L430,110" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="370" y="132" font-size="14" text-anchor="middle">make DESTDIR=… install</text>

  <rect class="box-b" x="436" y="24" width="290" height="120" rx="10"/>
  <text class="t-bad" x="454" y="50" font-size="15">the live machine — do not</text>
  <text class="t-xs" x="454" y="74">/usr/bin/mypkg</text>
  <text class="t-xs" x="454" y="94">/etc/mypkg.conf</text>
  <text class="t-xs" x="454" y="114">/var/lib/mypkg/state.db</text>
  <text class="t-xs" x="454" y="134">needs root, affects running state</text>

  <rect class="box-ok" x="436" y="160" width="290" height="120" rx="10"/>
  <text class="t-ok" x="454" y="186" font-size="15">the staging root — what you want</text>
  <text class="t-xs" x="454" y="210">/tmp/stage/usr/bin/mypkg</text>
  <text class="t-xs" x="454" y="230">/tmp/stage/etc/mypkg.conf</text>
  <text class="t-xs" x="454" y="250">/tmp/stage/var/lib/mypkg/state.db</text>
  <text class="t-xs" x="454" y="270">no root, no side effects, reusable</text>

  <path class="ln-ok" d="M726,220 L790,220" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-a" x="794" y="160" width="266" height="120" rx="10"/>
  <text class="t-accent" x="812" y="186" font-size="15">the .deb</text>
  <text class="t-xs" x="812" y="210">dpkg-deb --build stage</text>
  <text class="t-xs" x="812" y="230">strips the DESTDIR prefix</text>
  <text class="t-xs" x="812" y="250">and archives what is left,</text>
  <text class="t-xs" x="812" y="270">under the real paths</text>

  <rect class="box" x="794" y="24" width="266" height="120" rx="10"/>
  <text class="t-sm" x="812" y="50" font-size="15">where it stops working</text>
  <text class="t-xs" x="812" y="74">a path baked in at compile time:</text>
  <text class="t-xs" x="812" y="94">  configure --sysconfdir=/etc</text>
  <text class="t-xs" x="812" y="112">  → the string "/etc/mypkg.conf"</text>
  <text class="t-xs" x="812" y="130">  is inside the binary forever</text>

  <rect class="box-w" x="40" y="316" width="1020" height="278" rx="11"/>
  <text class="t-sm" x="58" y="342" font-size="15">the four things DESTDIR does not do, and what to do about each</text>

  <rect class="box-b" x="58" y="356" width="490" height="106" rx="9"/>
  <text class="t-bad" x="74" y="380" font-size="14">1 · it does not fix a wrong --prefix</text>
  <text class="t-xs" x="74" y="404">configure --prefix=/usr with no --sysconfdir puts config in /usr/etc.</text>
  <text class="t-xs" x="74" y="426">DESTDIR stages that faithfully into the package, so the bug ships.</text>
  <text class="t-xs" x="74" y="450">Fix: the configure flags. Then DESTDIR stages the right thing.</text>

  <rect class="box-b" x="560" y="356" width="490" height="106" rx="9"/>
  <text class="t-bad" x="576" y="380" font-size="14">2 · it does not run ldconfig</text>
  <text class="t-xs" x="576" y="404">A shared library in /usr/local/lib is invisible to the loader until</text>
  <text class="t-xs" x="576" y="426">ldconfig has read it. The fix is a maintainer script:</text>
  <text class="t-xs" x="576" y="450">postinst: ldconfig   ·   postrm: ldconfig</text>

  <rect class="box-b" x="58" y="474" width="490" height="106" rx="9"/>
  <text class="t-bad" x="74" y="498" font-size="14">3 · it does not create system state</text>
  <text class="t-xs" x="74" y="522">systemd symlinks, users, groups, directories with modes.</text>
  <text class="t-xs" x="74" y="544">These are maintainer-script jobs, and they must be idempotent:</text>
  <text class="t-xs" x="74" y="568">postinst runs on install AND on every upgrade.</text>

  <rect class="box-b" x="560" y="474" width="490" height="106" rx="9"/>
  <text class="t-bad" x="576" y="498" font-size="14">4 · it is not a chroot</text>
  <text class="t-xs" x="576" y="522">A configure probe that compiles and RUNS a test program still runs</text>
  <text class="t-xs" x="576" y="544">it on this host, with this kernel, not on the staged root.</text>
  <text class="t-xs" x="576" y="568">For a genuinely clean probe: a container, or --host + a cross toolchain.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "CMake and Meson: what the build files actually declare",
        p: [
          "Autotools is a code generator whose output is a script. CMake and Meson are languages whose output is a build graph. The difference shows up immediately in how you debug them, in how they cache, and in whether reconfiguration is safe.",
          "<strong>CMake</strong> is imperative C++ that writes a <code>CMakeCache.txt</code>. It is by far the most widely used of the three and the only one you will meet in pre-installed software, so knowing its failure modes matters even if you never write it. Two of them dominate. First, <code>CMakeCache.txt</code> is persistent and wins over everything: change a compiler path or a <code>-D</code> and it is remembered from the previous configure, which is why the standard cure for any inexplicable CMake behaviour is <code>rm -rf build</code> and not another <code>-D</code>. Second, <code>cmake .</code> in a source directory is a thing people still do by accident, and it deposits cache files into the source tree that then get archived into your package.",
          "The parts of CMake that matter when packaging are the <code>install</code> rules, because that is where paths are decided. <code>install(TARGETS mypkg DESTINATION bin)</code> is <em>relative</em> to <code>CMAKE_INSTALL_PREFIX</code> unless you use the <code>GNUInstallDirs</code> module, which defines <code>CMAKE_INSTALL_BINDIR</code> and friends that resolve to Debian's layout when <code>CMAKE_INSTALL_LIBDIR</code> is set to <code>lib/&lt;triplet&gt;</code>. Programs that ignore <code>GNUInstallDirs</code> and hardcode <code>\${CMAKE_INSTALL_PREFIX}/lib</code> are the usual reason a CMake-built package lands in the wrong library directory and then cannot be found by a correctly-built dependent.",
          "<strong>Meson</strong> is declarative: every target, option and dependency is declared before it is used, there is no equivalent of CMake's <code>if(NOT DEFINED foo)</code> that runs at a different time on the second configure. Meson therefore configures in under a second, reconfigures reliably, and defaults to the <strong>Ninja</strong> backend. <code>meson setup builddir</code>, <code>meson compile -j 4</code>, <code>meson test</code>, <code>meson install --destdir=/tmp/stage</code>. <code>meson setup --wipe</code> clears the cache, which is the correct answer to a stale-cache problem, and <code>meson configure</code> shows every option with its type — <code>feature</code>, <code>boolean</code>, <code>array</code>, <code>combo</code> — and its current value. Meson's subprojects are the other half: <code>subprojects/*.wrap</code> files describe a pinned upstream tarball or git commit, so <code>meson</code> can build a dependency from source without any packaging system at all, which is its most underrated feature and also a supply-chain surface you should read before running it.",
          "<strong>Ninja</strong> is not a language. It is a scheduler that consumes a DAG. It has no pattern rules beyond the simplest form, no shell-function magic, no recursive make, and it computes the minimum parallel schedule from a machine-readable graph. The practical consequences: <code>ninja -t targets</code> lists everything the build can produce, <code>ninja -t graph</code> draws the DAG, and — the one you will actually use — <code>ninja -t commands</code> prints the exact command for every rule, which is how you see what the build system decided to do to your <code>CFLAGS</code> without reading its language."
        ]
      },
      {
        type: "table",
        cols: ["", "autotools", "CMake", "Meson + Ninja"],
        rows: [
          ["Model", "Generates shell scripts and Makefiles. The generated <code>configure</code> is 500 kB of portable probes.", "Imperative language, persistent cache, generates a build system.", "Declarative language, no arbitrary side effects, generates Ninja files."],
          ["Configure", "<code>./configure &amp;&amp; make</code>", "<code>cmake -S . -B build -DCMAKE_BUILD_TYPE=Release</code>", "<code>meson setup builddir</code>"],
          ["Build", "<code>make -j</code>", "<code>cmake --build build -j</code>", "<code>meson compile -j 4</code> (or <code>ninja -C build</code>)"],
          ["Install path control", "<code>--prefix</code> and friends, which the Makefile interpolates", "<code>CMAKE_INSTALL_PREFIX</code> plus <code>install(TARGETS … DESTINATION)</code>, ideally via <code>GNUInstallDirs</code>", "<code>--prefix</code>, and per-target <code>install_dir</code> properties"],
          ["Staged install", "<code>make DESTDIR=/stage install</code>", "<code>DESTDIR=/stage cmake --install build</code>", "<code>meson install --destdir /stage</code>"],
          ["Reconfigure", "<code>./config.status</code> re-runs from the cache without probing", "<code>cmake -B build</code> reuses <code>CMakeCache.txt</code>. <code>rm -rf build</code> is the honest reset.", "<code>meson setup --reconfigure</code>, or <code>--wipe</code> to reset. Fast because nothing is probed."],
          ["Tests", "<code>make check</code> (automake) or a hand-rolled target", "<code>ctest</code>, with <code>add_test</code> and <code>enable_testing()</code>", "<code>meson test</code>, with <code>test()</code> declared inline"],
          ["Find a dependency", "<code>AC_CHECK_LIB</code> / <code>PKG_CHECK_MODULES</code> in <code>configure.ac</code>", "<code>find_package</code>, <code>pkg_check_modules</code> from <code>FindPkgConfig</code>", "<code>dependency('zlib')</code>, which uses pkg-config under the hood"],
          ["Vendored dependencies", "None. You download and install them yourself, which is where <code>--prefix=/usr/local</code> culture comes from.", "FetchContent, ExternalProject", "<code>subprojects/*.wrap</code>, pinned to a URL + hash or a git commit"],
          ["Debugging it fails", "<code>config.log</code> — the last few hundred lines. Almost always the answer.", "<code>cmake --log-level=DEBUG --trace-expand</code>, then <code>CMakeCache.txt</code>", "<code>meson setup --verbose</code> if it fails at setup; <code>meson compile -v</code> if it fails at build"],
          ["When you will meet it", "Everything older, and a great deal of C infrastructure. Worth knowing because the flags are the packaging-relevant part.", "Widest adoption. Most pre-installed software on a modern system.", "Increasing default for new C/C++ projects. Fast to learn if you know what the build file declares."]
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The same project built three ways, and how to see what each build system actually decided",
        code: `# ---- CMake, out of tree, with Debian's layout ----
$ sudo apt-get install cmake
$ cmake -S . -B build \\
    -DCMAKE_BUILD_TYPE=Release \\
    -DCMAKE_INSTALL_PREFIX=/usr \\
    -DCMAKE_INSTALL_LIBDIR=lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH) \\
    -DCMAKE_INSTALL_SYSCONFDIR=/etc \\
    -DCMAKE_INSTALL_LOCALSTATEDIR=/var
$ cmake --build build -j"$(nproc)"
$ DESTDIR="$PWD/../stage" cmake --install build

# what did it decide? these four commands answer almost any "why did it do that"
$ cmake -LA -N build                     # every cache variable and its value
$ grep CMAKE_C_FLAGS build/CMakeCache.txt
$ cat build/CMakeFiles/foo.dir/flags.make
$ cmake --build build -v                # the actual compiler command lines

# ---- Meson ----
$ sudo apt-get install meson ninja-build
$ meson setup builddir --prefix=/usr \\
      --libdir=lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH) \\
      --sysconfdir=/etc --localstatedir=/var
$ meson configure                        # every option, its type, its value
$ meson compile -j 2
$ meson test -C builddir --print-errorlogs
$ meson install -C builddir --destdir "$PWD/../stage"

# ---- Ninja, on its own ----
$ ninja -C builddir -t targets           # everything the graph can produce
$ ninja -C builddir -t graph | head -40  # the DAG
$ ninja -C builddir -t commands | head   # the exact commands — this is the one you want
$ ninja -C builddir -d explain -v        # why this edge exists

# ---- the Debian packaging shortcut for all three ----
$ sudo apt-get install debhelper dh-make fakeroot
# debian/rules is then, in full:
#     #!/usr/bin/make -f
#     %:
#         dh $@ --buildsystem=autotools|cmake|meson|ninja
#   dh_auto_configure / dh_auto_build / dh_auto_test / dh_auto_install
#   dh_install, dh_installsystemd, dh_installdeb, dh_md5sums, dh_builddeb, dh_gencontrol
#   compat level: 9 is ancient, 10 added systemd units, 11 changed conffile handling,
#   12 is current for 18.04-era and still usable`
      },
      {
        type: "prose",
        h: "Dynamic versus static, and what actually happens at run time",
        p: [
          "<strong>Static linking</strong> resolves every symbol at link time and produces a self-contained executable. <code>-static</code> links everything; <code>-static-libgcc</code> and <code>-static-libstdc++</code> are the partial versions that people actually use, because statically linking glibc into every process wastes memory, breaks NSS (which needs <code>dlopen</code> of <code>libnss_*.so</code>), and quietly prevents you from getting a libc security fix until you rebuild.",
          "<strong>Dynamic linking</strong> leaves the library resolution to <code>ld.so</code> at run time and records what is needed in <code>DT_NEEDED</code>. The trade is the classic one: smaller binaries, shared pages of libc in memory across every process, independent library upgrades, and in exchange a run-time dependency the binary does not control. For a service on a server, dynamic with a managed library set is almost always correct. For a statically linked binary you drop on a minimal container with no libc at all, static is correct and has no downside worth naming.",
          "The three numbers worth knowing: <code>ldd</code> shows the resolved tree (and warns about things it had to substitute); <code>readelf -d</code> shows what the file <em>asked</em> for, which is safer to run on an untrusted binary because it does not execute anything; and <code>patchelf --print-needed</code> is the fast modern way when you have it. Use <code>readelf</code>, not <code>ldd</code>, on anything you did not build — <code>ldd</code> genuinely runs the file under <code>LD_TRACE_LOADED_OBJECTS</code>, and on older systems a crafted binary could make it do other things instead.",
          "<strong>RPATH versus RUNPATH</strong> is the detail that separates people who have debugged a shared library from people who have not. Both put a search path in the ELF, but they differ in two ways that both matter. <strong>Precedence</strong>: <code>DT_RPATH</code> is searched before <code>LD_LIBRARY_PATH</code>; <code>DT_RUNPATH</code> is searched after it. <strong>Inheritance</strong>: <code>DT_RPATH</code> applies transitively to the dependencies of everything that depends on it; <code>DT_RUNPATH</code> applies only to the direct dependencies of the object that carries it. The modern linker default is <code>RUNPATH</code>, and it is the more flexible of the two. It is also the one an attacker can subvert with an environment variable on a setuid program — except that setuid binaries get <code>AT_SECURE</code>, which makes <code>ld.so</code> ignore <code>LD_LIBRARY_PATH</code>, <code>LD_PRELOAD</code> and <code>LD_DEBUG</code> entirely, which is the glibc side of the <code>nosuid</code> guarantee.",
          "<strong>ldconfig</strong> is the piece nobody explains. It reads <code>/etc/ld.so.conf</code> plus every file in <code>/etc/ld.so.conf.d/</code>, globs the directories, and writes a hashed index — <code>/etc/ld.so.cache</code> — that <code>ld.so</code> consults before falling back to its compiled-in default directories. That is why a library in <code>/usr/local/lib</code> can be found on one distro and not another: it depends on whether that directory appears in a <code>ld.so.conf.d</code> fragment. On Ubuntu 18.04, <code>/etc/ld.so.conf.d/x86_64-linux-gnu.conf</code> lists <code>/usr/local/lib/x86_64-linux-gnu</code>, <code>/usr/local/lib64</code>, <code>/lib/x86_64-linux-gnu</code>, <code>/usr/lib/x86_64-linux-gnu</code>, <code>/lib</code> and <code>/usr/lib</code>. Run <code>ldconfig -p</code> to see the cache, <code>ldconfig -v</code> to see it being rebuilt, and <code>ldconfig -X -v</code> to see the symlinks it will create and does not — <code>-X</code> never links, which is the flag to use on a machine where you care."
        ]
      },
      {
        type: "table",
        cols: ["Dynamic tag", "Meaning", "Why it matters"],
        rows: [
          ["<code>DT_NEEDED</code>", "A shared object this file needs resolved", "The actual dependency list. <code>readelf -d bin | grep NEEDED</code>. With <code>--as-needed</code> (the Ubuntu default) a library nobody used is absent here, which surprises people who expect it in <code>ldd</code> output."],
          ["<code>DT_SONAME</code>", "The name this library answers to", "<code>libfoo.so.1</code>. The file on disk is <code>libfoo.so.1.2.3</code>, with symlinks <code>libfoo.so.1 → libfoo.so.1.2.3</code> and <code>libfoo.so → libfoo.so.1</code>. <code>libfoo.so</code> is in the <code>-dev</code> package; the SONAME symlink is in the runtime package."],
          ["<code>DT_RPATH</code>", "Search path, highest precedence, transitive", "Cannot be overridden by <code>LD_LIBRARY_PATH</code>. Still emitted by <code>chrpath --hardcode-rpath</code> and by some build systems."],
          ["<code>DT_RUNPATH</code>", "Search path, after <code>LD_LIBRARY_PATH</code>, non-transitive", "The linker default since the 2000s. More flexible; overridable by an environment variable unless <code>AT_SECURE</code> is set."],
          ["<code>PT_INTERP</code>", "The program interpreter", "For a dynamic binary, the entry point is <code>ld-linux-x86-64.so.2</code>, not <code>main</code>. A static binary has no <code>PT_INTERP</code> at all."],
          ["<code>-rpath-link</code> / <code>--allow-shlib-undefined</code>", "Link-time search path for finding libraries", "<code>-rpath-link</code> lets ld find a dependency's own dependencies without putting them on your <code>-rpath</code>. <code>--allow-shlib-undefined</code> silences a class of errors and is a thing to be suspicious of."],
          ["<code>/etc/ld.so.cache</code>", "The hashed directory index", "Built by <code>ldconfig</code>. Stale entries for a removed library produce <code>cannot open shared object file: No such file or directory</code> that is fixed by <code>ldconfig</code> and nothing else."],
          ["<code>/etc/ld.so.preload</code>", "Libraries loaded before everything else", "Equivalent to a global <code>LD_PRELOAD</code>. There is no legitimate reason for this file to exist on your server. If it does, you have an incident."],
          ["<code>DT_FLAGS_1</code> PIE bit", "Position-independent executable", "The Ubuntu default since 11.10. Building a <em>shared library</em> still needs explicit <code>-fPIC</code>; the PIE default does not cover it, which is the source of the ubiquitous <code>recompile with -fPIC</code> relocation error."]
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Diagnose a binary that will not start, from the outside in",
        code: `# what does it want?  (safe — readelf does not execute anything)
$ readelf -d ./myprog | grep -E 'NEEDED|RPATH|RUNPATH|SONAME'
$ readelf -l ./myprog | grep -A1 INTERP
$ readelf -h ./myprog | grep Type        # DYN = PIE, EXEC = non-PIE, or nothing for a .o

# what does it get?  (ldd DOES execute it — readelf above if the file is not yours)
$ ldd ./myprog
	libssl.so.1.1 => not found
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f9a…)

# three ways to fix "not found", in order of preference
$ sudo apt-get install libssl1.1                    # the honest fix: install the library
$ export LD_LIBRARY_PATH=/opt/mylibs:$LD_LIBRARY_PATH   # temporary, per-shell, not for daemons
$ sudo ldconfig && ldconfig -p | grep libssl       # rebuild the cache — only works if the
                                                     # directory is already in ld.so.conf.d

# what does the loader think, step by step?
$ LD_DEBUG=libs      ./myprog 2>loader.log   # every open() of a library, and why it was chosen
$ LD_DEBUG=bindings  ./myprog 2>&1 | head    # symbol-by-symbol binding decisions
$ LD_DEBUG=files     ./myprog                # every file opened, including non-libraries
$ LD_DEBUG=all       ./myprog 2>&1 | wc -l  # the firehose
$ LD_DEBUG_OUTPUT=/tmp/ld ./myprog            # write to /tmp/ld.<pid> instead of stderr
#   LD_DEBUG is silently ignored when AT_SECURE is set — i.e. for any setuid/setgid binary.
#   That is not a bug; it is the glibc half of the nosuid guarantee.

# was the library the wrong ABI?
$ readelf -d ./myprog | grep SONAME
$ objdump -p /lib/x86_64-linux-gnu/libssl.so.1.1 | grep SONAME
#   if the SONAME the linker recorded is libssl.so.1.1 and the file is libssl.so.1.0.0,
#   nothing you do to PATH will help. You built against the wrong -dev package.

# an RPATH into a directory that no longer exists is a silent, permanent footgun:
$ readelf -d ./myprog | grep -i path
$ patchelf --print-rpath ./myprog
$ patchelf --set-rpath '$ORIGIN/../lib' ./myprog    # the only relative form worth knowing
$ chrpath --list ./myprog                           # the other tool that does this`
      },
      {
        type: "prose",
        h: "/usr/local versus /usr, and what that choice costs you over three years",
        p: [
          "FHS reserves <code>/usr/local</code> for software installed by the system administrator, explicitly <em>not</em> managed by the packaging system, and explicitly required not to conflict with anything in <code>/usr</code>. <code>/usr/bin</code> precedes <code>/usr/local/bin</code> on Debian's default <code>PATH</code>, so the packaged binary wins — but only if both exist, and only for <code>PATH</code> lookups. <code>ld.so</code> consults <code>RUNPATH</code> and <code>ld.so.cache</code>, which have their own order, and a <code>/usr/local/lib/libssl.so.1.1</code> will be found by anything with that in its <code>RUNPATH</code> whether or not the administrator meant it.",
          "The consequences accumulate quietly. A hand-built library in <code>/usr/local/lib</code> never receives a security update, because nothing knows it exists. It is not in <code>dpkg -L</code> for any package, so <code>dpkg -V</code> cannot verify it and <code>dpkg -r</code> will not remove it. It will not be in a container image unless the Dockerfile copies it, so the staging machine and production diverge silently. It survives every rebuild of the base image and accumulates four years of versioned binaries until someone cannot say which one is in use. And because <code>/usr/local</code> is not covered by the package database, the first person to hit a bug there has no way to reproduce the environment from the documentation.",
          "The rule that avoids all of this is simple and worth stating: <strong>anything that should still be there in three years belongs in a package.</strong> If you cannot package it, install it into a versioned directory under <code>/opt</code>, record the version and the build flags in the repository next to it, and reference it by absolute path from the unit file. That is more work today and considerably less work the first time something breaks."
        ]
      },
      {
        type: "prose",
        h: "Cross-compiling: the triple, the sysroot, and the flag everyone gets wrong",
        p: [
          "A cross toolchain is identified by a <strong>triplet</strong>: <code>target</code>-<code>vendor</code>-<code>os</code>, optionally with a fourth ABI component. <code>aarch64-linux-gnu</code> is 64-bit ARM with the GNU toolchain and the system ABI; <code>arm-linux-gnueabihf</code> is 32-bit ARM with hard float; <code>x86_64-linux-gnu</code> is this machine; <code>x86_64-w64-mingw32</code> is Windows; <code>aarch64-linux-musl</code> is Alpine's libc. The triplet is not a label — it is a naming convention that every tool in the chain agrees on, so that <code>aarch64-linux-gnu-gcc</code> invokes <code>aarch64-linux-gnu-ld</code> and knows where the target's headers are.",
          "The packages are <code>gcc-aarch64-linux-gnu</code>, <code>binutils-aarch64-linux-gnu</code>, <code>libc6-dev-arm64-cross</code>, and the convenience bundle <code>crossbuild-essential-arm64</code>. The environment variables are <code>CC=aarch64-linux-gnu-gcc</code>, <code>CXX</code>, <code>AR</code>, <code>RANLIB</code>, <code>STRIP</code>, <code>LD</code>, <code>PKG_CONFIG_LIBDIR</code> and <code>PKG_CONFIG_SYSROOT_DIR</code>. That last pair is the one that silently breaks autotools builds: <code>pkg-config</code> will happily return the <em>host's</em> <code>-I</code> and <code>-L</code> flags from a <code>.pc</code> file, and you will end up compiling arm64 code that includes x86-64 headers.",
          "<strong>--sysroot</strong> is the other half. It tells gcc where the target's <code>/usr/include</code> and <code>/usr/lib</code> live, so <code>#include &lt;zlib.h&gt;</code> resolves into the cross sysroot rather than the host's <code>/usr/include</code>. It does not change where the compiler's own runtime bits are, which is intentional — <code>ld</code> still needs the host <code>libgcc</code> and <code>crt</code> objects. Passing <code>--sysroot</code> also to the linker (<code>--sysroot=</code> on the <code>LDFLAGS</code>) is what makes the final link look in the target libraries. Where you cannot get a complete sysroot, the honest answer is to link statically, which is why <code>musl</code>-based cross builds are so much easier: a single self-contained <code>.a</code>.",
          "<strong>--host versus --target</strong> is the autotools confusion that costs an afternoon. For a program you are compiling, <code>--host</code> is the machine the program will run on: <code>./configure --host=aarch64-linux-gnu</code>. For a program that is itself a cross compiler, <code>--target</code> is that machine. Nobody has ever needed <code>--target</code> when building an application. If <code>configure</code> does not recognise your triplet it silently assumes it is running natively, and the resulting build looks fine until it cannot run its own tests on an arm64 machine.",
          "The last piece is not compiling at all: to <em>run</em> an arm64 binary on x86-64 you need either a real arm64 machine or <code>qemu-user-static</code> with <code>binfmt_misc</code> registered, which makes <code>execve</code> hand unknown-format files to qemu. That is what <code>docker run --platform linux/arm64</code> and most CI cross-build images use, and it is the reason a <code>make check</code> inside such a container is slow but works."
        ]
      },
      {
        type: "diagram",
        h: "Two build trees, one set of variables",
        caption: "Everything that matters is a variable pointing somewhere else. <code>CC</code> picks the compiler, <code>--sysroot</code> picks the headers and target libraries, and <code>PKG_CONFIG_LIBDIR</code> picks which <code>.pc</code> files are visible — miss that last one and the build silently mixes x86-64 headers into arm64 objects, which is the single most common cross-compilation failure.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Cross compilation diagram showing target sysroot, host tools, and pkg-config variables resolving to the right tree">
  <text class="t-title" x="40" y="34" font-size="17">building for aarch64 on x86_64</text>

  <rect class="box-ok" x="40" y="52" width="440" height="216" rx="11"/>
  <text class="t-ok" x="58" y="78" font-size="15">the target sysroot — arm64 files</text>
  <text class="t-xs" x="58" y="104">$SYSROOT = /usr/aarch64-linux-gnu</text>
  <rect class="box" x="58" y="116" width="180" height="30" rx="6"/>
  <text class="t-sm" x="72" y="136">include/zlib.h</text>
  <rect class="box" x="250" y="116" width="212" height="30" rx="6"/>
  <text class="t-sm" x="264" y="136">lib/libz.so.1 → .1.2.11</text>
  <rect class="box" x="58" y="152" width="180" height="30" rx="6"/>
  <text class="t-sm" x="72" y="172">lib/pkgconfig/zlib.pc</text>
  <rect class="box" x="250" y="152" width="212" height="30" rx="6"/>
  <text class="t-sm" x="264" y="172">lib/libssl.so.1.1</text>
  <rect class="box" x="58" y="188" width="404" height="30" rx="6"/>
  <text class="t-sm" x="72" y="208">lib/crt1.o  crti.o  crtn.o  libc.so</text>
  <text class="t-xs" x="58" y="246">from libc6-dev-arm64-cross, which is the package people forget</text>

  <rect class="box-v" x="520" y="52" width="540" height="216" rx="11"/>
  <text class="t-violet" x="538" y="78" font-size="15">the host tools — x86_64 binaries</text>
  <text class="t-xs" x="538" y="104">aarch64-linux-gnu-gcc   →  aarch64-linux-gnu-as  →  aarch64-linux-gnu-ld</text>
  <text class="t-xs" x="538" y="128">plus the HOST's crtbegin.o / crtend.o / libgcc — the compiler's own bits,</text>
  <text class="t-xs" x="538" y="146">deliberately NOT redirected by --sysroot</text>
  <rect class="box-p" x="538" y="158" width="252" height="30" rx="6"/>
  <text class="t-sm" x="552" y="178">cppflags: --sysroot=$SYSROOT</text>
  <rect class="box-p" x="802" y="158" width="240" height="30" rx="6"/>
  <text class="t-sm" x="816" y="178">cflags: -O2 -g</text>
  <rect class="box-p" x="538" y="194" width="504" height="30" rx="6"/>
  <text class="t-sm" x="552" y="214">ldflags: -L$SYSROOT/lib -Wl,--sysroot=$SYSROOT -Wl,-rpath-link,$SYSROOT/lib</text>
  <text class="t-xs" x="538" y="246">everything comes from dpkg-buildflags plus three --sysroot flags</text>

  <path class="ln-a" d="M480,120 L518,120" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M480,164 L518,164" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M480,208 L518,208" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="40" y="296" width="1020" height="150" rx="11"/>
  <text class="t-sm" x="58" y="322" font-size="15">the pkg-config trap, drawn out because it is silent</text>
  <text class="t-xs" x="58" y="348">pkg-config reads .pc files. By default it reads the HOST's /usr/lib/x86_64-linux-gnu/pkgconfig, so:</text>
  <rect class="box-b" x="58" y="358" width="484" height="76" rx="8"/>
  <text class="t-sm" x="72" y="382">unset</text>
  <text class="t-xs" x="72" y="404">-I/usr/include/x86_64-linux-gnu -L/usr/lib/x86_64-linux-gnu</text>
  <text class="t-xs" x="72" y="424">arm64 code including x86-64 headers. Compiles. Produces garbage.</text>
  <rect class="box-ok" x="560" y="358" width="484" height="76" rx="8"/>
  <text class="t-sm" x="574" y="382">PKG_CONFIG_LIBDIR=$SYSROOT/lib/pkgconfig</text>
  <text class="t-xs" x="574" y="404">PKG_CONFIG_SYSROOT_DIR=$SYSROOT</text>
  <text class="t-xs" x="574" y="424">now every path pkg-config emits is prefixed with the sysroot. Correct.</text>

  <rect class="box-a" x="40" y="474" width="1020" height="142" rx="11"/>
  <text class="t-sm" x="58" y="500" font-size="15">verify before you trust it — three checks that catch every one of these mistakes</text>
  <text class="t-xs" x="58" y="524">aarch64-linux-gnu-gcc -dumpmachine            →  aarch64-linux-gnu   (it picked up the triplet)</text>
  <text class="t-xs" x="58" y="546">aarch64-linux-gnu-gcc -E -Wp,-v -xc /dev/null 2&gt;&amp;1 | grep include   →  arm64 sysroot, then /usr/local/include,</text>
  <text class="t-xs" x="58" y="564">                                                             then the compiler's own. Read the order.</text>
  <text class="t-xs" x="58" y="588">file ./myprog                              →  ELF 64-bit LSB … ARM aarch64, dynamically linked</text>
  <text class="t-xs" x="58" y="608">qemu-aarch64 -L /usr/aarch64-linux-gnu ./myprog --version   →  actually runs it, if you have qemu-user-static</text>
</svg>
`
      },
      {
        type: "prose",
        h: "From a staged tree to a .deb",
        p: [
          "A <code>.deb</code> is a directory containing <code>DEBIAN/</code> and a filesystem tree. That is the whole format. <code>DEBIAN/control</code> is the same stanza format as the one inside a binary package — <code>Package</code>, <code>Version</code>, <code>Architecture</code>, <code>Maintainer</code>, <code>Installed-Size</code> in kibibytes, <code>Section</code>, <code>Priority</code>, <code>Depends</code>, and a <code>Description</code> whose first line is the synopsis and whose continuation lines are indented, one per paragraph. <code>DEBIAN/conffiles</code> lists the configuration paths, <code>DEBIAN/postinst</code> and <code>DEBIAN/prerm</code> are maintainer scripts, and the mode bits on those scripts matter: a postinst that is not executable is a <code>dpkg</code> error at install time, not a warning.",
          "<code>dpkg-deb --build &lt;dir&gt; &lt;out.deb&gt;</code> does three things you should know about. It validates the control file and refuses obviously broken metadata. It strips the leading <code>./</code> and produces paths relative to the directory, so a file staged at <code>stage/usr/bin/foo</code> lands in the package as <code>/usr/bin/foo</code> and nowhere else. And since dpkg 1.18.5 it rewrites ownership to <code>root:root</code> in the archive when <code>--root-owner-group</code> is given, which has been the default since 1.19 — so on Ubuntu 18.04 you do not need root to build a package at all, which is what makes <code>dpkg-buildpackage</code> safe in a CI container.",
          "What you still need is correct ownership <em>inside</em> the tree and the right modes, and that is <code>fakeroot</code>'s job: an LD_PRELOAD shim that intercepts the ownership-setting syscalls and answers from environment variables, so <code>make install</code> believes it ran as root while running entirely in your user namespace. <code>debhelper</code> calls it for you. The failure if you skip it is subtle rather than catastrophic — files owned by <code>alexgris</code> in an otherwise correct package, which installs and works and quietly breaks the next time you <code>tar</code> the tree or run a user-namespace container with it.",
          "<code>dpkg-buildpackage -us -uc</code> wraps the whole thing: it runs <code>debian/rules binary</code>, puts the result in the parent directory, and <code>-us -uc</code> says 'do not sign' — which you want locally and never want in a repository. It also builds the source package by default, so <code>-b</code> to skip it and <code>-nc</code> if you want a binary-only build."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Build a real .deb from a staged tree, by hand, with no debhelper",
        code: `# the staged tree from earlier
$ cd stage
$ install -d DEBIAN

# the control file. the Description continuation lines MUST start with a space
$ cat > DEBIAN/control <<'EOF'
Package: mypkg
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Maintainer: You <you@example.com>
Installed-Size: 412
Depends: libc6 (>= 2.27), libssl1.1 (>= 1.1.0)
Description: a small thing that does one job
 mypkg does exactly one job and explains it here.
 .
 This paragraph is the extended description. A line with
 just a dot represents a blank line.
EOF

# optional: config files dpkg must never overwrite
$ printf '/etc/mypkg.conf\n' > DEBIAN/conffiles

# optional: the maintainer script. it must be executable, and idempotent,
# because it runs on install AND on every upgrade
$ cat > DEBIAN/postinst <<'EOF'
#!/bin/sh
set -e
case "$1" in
  configure)
    ldconfig
    if [ -d /run/systemd/system ]; then
      systemctl daemon-reload
      systemctl enable mypkg.service >/dev/null 2>&1 || true
      systemctl --no-reload start mypkg.service || true
    fi
    ;;
  abort-upgrade|abort-remove|abort-deconfigure) ;;
esac
exit 0
EOF
$ chmod 0755 DEBIAN/postinst

# lint it first — most of the "why will Lintian reject this" questions answer here
$ sudo apt-get install lintian
$ lintian --no-tag-display-limit .

# package it. --root-owner-group is the default on dpkg 1.19+, so no root needed
$ cd ..
$ dpkg-deb --build --root-owner-group stage mypkg_1.0.0_amd64.deb
$ dpkg-deb -I mypkg_1.0.0_amd64.deb      # control only
$ dpkg-deb -c mypkg_1.0.0_amd64.deb      # the file list
$ dpkg-deb -e mypkg_1.0.0_amd64.deb /tmp/meta   # extract just DEBIAN/

# install it and check the state landed where it should
$ sudo dpkg -i mypkg_1.0.0_amd64.deb
$ dpkg -l mypkg | tail -1
ii  mypkg  1.0.0  amd64  a small thing that does one job

# ---- the same thing with debhelper, which is what you should actually ship ----
$ cd mypkg-1.0.0 && dpkg-buildpackage -us -uc -b
#   runs debian/rules build, which is: dh $@ --buildsystem=autotools
#   dh_auto_configure — ./configure with the flags from debian/rules
#   dh_auto_build     — make -j
#   dh_auto_test      — make check
#   dh_auto_install   — make install DESTDIR=debian/mypkg
#   dh_install, dh_installsystemd, dh_installdeb, dh_md5sums, dh_gencontrol, dh_builddeb
#   the .deb lands in the PARENT directory`
      },
      {
        type: "prose",
        h: "Reading what actually went wrong: four tools, four layers",
        p: [
          "<strong>Linker errors</strong> are the most common failure and the most stereotyped. <code>cannot find -lfoo</code> means the linker never found a file to open: the <code>libfoo.so</code> symlink lives in the <code>-dev</code> package, not the runtime one, so <code>ldconfig</code> cannot help and installing the runtime library will not fix it. <code>undefined reference to 'foo'</code> means the library was found but the symbol was not in it — usually a version mismatch, a <code>static_assert</code> selecting a different signature, or the wrong <code>-dev</code> package among several that provide the same <code>.pc</code> file. For static archives the order of <code>-l</code> flags is significant and left-to-right: <code>-lfoo -lbar</code> can work where <code>-lbar -lfoo</code> does not. And <code>multiple definition of 'x'</code> on Ubuntu 20.04 or later, where gcc 9 made <code>-fno-common</code> the default, is a real event: tentative definitions in headers stopped merging into <code>.bss</code>, so two translation units each emitted a symbol and third-party libraries that had been fine for a decade stopped linking. The fix is <code>-fcommon</code>, and it is a property of the compiler version, not of your code.",
          "<strong>strace</strong> answers 'what did the process actually try to do to the system'. <code>strace -f -e trace=openat ./prog</code> shows every file the loader opened and every <code>ENOENT</code> in between, which is the fastest way to find a missing library or a wrong path. <code>-e trace=execve</code> shows the exact chain of executions when a wrapper script or a <code>#!</code> handler is involved. <code>-f</code> follows children, <code>-e trace=%file</code> is the shorthand for the file syscalls, <code>-o file</code> keeps it out of the interleave. It is slow — an order of magnitude — so use it on the failure, not as a matter of course.",
          "<strong>ltrace</strong> intercepts calls into shared libraries and is a different tool: <code>ltrace -e 'malloc+free+memcpy' ./prog</code> shows glibc-level calls, which is how you find an allocation that returns null and a <code>free</code> of it. It cannot see inside libc, it misses statically linked code entirely, and it is more fragile than strace. For memory bugs, <code>valgrind</code> or a rebuild with <code>-fsanitize=address,undefined</code> is strictly better than either.",
          "<strong>gdb</strong> for the state, <strong>nm</strong> and <strong>objdump</strong> for the static contents. <code>nm -C obj</code> lists symbols — uppercase for external, lowercase for local, <code>U</code> for undefined — and <code>nm -D</code> limits it to the dynamic symbol table, which is what the loader actually uses. <code>objdump -d</code> disassembles <code>.text</code> and <code>objdump -D</code> everything including data sections; <code>-S</code> interleaves source when debug info is present, and on x86-64 the default syntax is AT&T, so <code>-M intel</code> is worth memorising. For a core dump, the modern path on this release is <code>coredumpctl</code> from systemd 237, which needs <code>Storage=external</code> uncommented in <code>/etc/systemd/coredump.conf</code> — Ubuntu ships it commented out, so a segfault produces nothing until you change that file and <code>systemd-coredump</code> is installed. When you do have a binary with no symbols, the standard pair is <code>objcopy --only-keep-debug</code> at build time, <code>objcopy --add-gnu-debuglink</code> to reference it, and <code>eu-unstrip</code> from elfutils to recover symbols from a stripped binary that still has a build-id."
        ]
      },
      {
        type: "diagram",
        h: "Debugging ladder: which tool answers which question",
        caption: "Each rung answers a strictly narrower question than the one below it, which is why the order matters. <code>dpkg -S</code> is at the top because the majority of 'it will not build' questions on a Debian system are answered by a single package lookup and nothing more.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="Debugging ladder from package lookup through include search, compiler output, linker output, loader trace and debugger">
  <rect class="box-ok" x="40" y="24" width="1020" height="72" rx="10"/>
  <text class="t-ok" x="58" y="50" font-size="15">Q1 · which package provides the header or library I am missing?</text>
  <text class="t-xs" x="58" y="72">dpkg -S '*/zlib.h'   ·   apt-file search zlib.h   (apt-get install apt-file; apt-file update)   ·</text>
  <text class="t-xs" x="58" y="90">dpkg -l | grep -E 'lib.*-dev'   ·   pkg-config --modversion zlib   ·   dnf provides '*/zlib.h'   ·   pacman -F zlib.h</text>

  <path class="ln" d="M550,96 L550,120" marker-end="url(#lm-arrow)"/>

  <rect class="box-v" x="40" y="124" width="1020" height="72" rx="10"/>
  <text class="t-violet" x="58" y="150" font-size="15">Q2 · what is the compiler actually being told to look at?</text>
  <text class="t-xs" x="58" y="172">gcc -E -Wp,-v -xc /dev/null 2&gt;&amp;1 | sed -n '/search starts here/,/End of search/p'</text>
  <text class="t-xs" x="58" y="190">that is the entire include search path, in order, including the compiler's own private directories</text>

  <path class="ln" d="M550,196 L550,220" marker-end="url(#lm-arrow)"/>

  <rect class="box-a" x="40" y="224" width="1020" height="72" rx="10"/>
  <text class="t-accent" x="58" y="250" font-size="15">Q3 · what did the compiler decide, and what does it emit?</text>
  <text class="t-xs" x="58" y="272">gcc -### file.c -o file   ·   gcc -v   ·   make V=1   ·   meson compile -v   ·   ninja -t commands   ·   cmake --build -v</text>
  <text class="t-xs" x="58" y="290">the "-###" form prints the subprocess command lines without running them — the first thing to check on any build</text>

  <path class="ln" d="M550,296 L550,320" marker-end="url(#lm-arrow)"/>

  <rect class="box-w" x="40" y="324" width="1020" height="72" rx="10"/>
  <text class="t-warn" x="58" y="350" font-size="15">Q4 · what could the linker not resolve, and from what?</text>
  <text class="t-xs" x="58" y="372">ld -Wl,--verbose  ·   nm -C -u file.o   ·   nm -D libfoo.so | grep ' T '   ·   readelf -d bin | grep NEEDED</text>
  <text class="t-xs" x="58" y="390">every U in nm -u is a promise to the linker. The first library that does not define it is named in the error.</text>

  <path class="ln" d="M550,396 L550,420" marker-end="url(#lm-arrow)"/>

  <rect class="box-p" x="40" y="424" width="1020" height="72" rx="10"/>
  <text class="t-bad" x="58" y="450" font-size="15">Q5 · at run time, what is it really doing to the system?</text>
  <text class="t-xs" x="58" y="472">LD_DEBUG=libs,bindings,files ./prog 2&gt;ld.log   ·   strace -f -e trace=%file ./prog   ·   ltrace -e 'malloc+free' ./prog</text>
  <text class="t-xs" x="58" y="490">LD_DEBUG tells you ld.so's decisions. strace tells you every syscall. Neither tells you what the code means.</text>

  <path class="ln" d="M550,496 L550,520" marker-end="url(#lm-arrow)"/>

  <rect class="box-b" x="40" y="524" width="1020" height="112" rx="10"/>
  <text class="t-bad" x="58" y="550" font-size="15">Q6 · what was the state when it broke?</text>
  <text class="t-xs" x="58" y="574">ulimit -c unlimited  ·  systemctl edit service → LimitCORE=infinity  ·  coredumpctl list / coredumpctl gdb / coredumpctl debug</text>
  <text class="t-xs" x="58" y="596">gdb --args ./prog a b  ·  b main  ·  run  ·  bt  ·  info sharedlibrary  ·  p *ptr  ·  thread apply all bt  ·  disas /r $pc,40</text>
  <text class="t-xs" x="58" y="620">coredumpctl needs Storage=external in /etc/systemd/coredump.conf (commented out by default on 18.04) and the</text>
  <text class="t-xs" x="58" y="638">systemd-coredump package. Without that, a segfault leaves you a number and nothing else.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "Toolchain essentials and the X.h loop",
        p: [
          "The minimum for compiling anything on Ubuntu is <code>build-essential</code>: <code>gcc</code>, <code>g++</code>, <code>make</code>, <code>libc6-dev</code> and <code>dpkg-dev</code>. It is a meta-package, so inspecting it tells you nothing you can act on — either it is installed or the build stops. What you add on top depends entirely on what you are building, and the two things you add most often are <code>pkg-config</code> and a <code>-dev</code> package.",
          "A <code>-dev</code> package contains four things: the headers, the <code>.pc</code> file, the unversioned <code>.so</code> symlink, and the static archive <code>.a</code>. The runtime package contains one thing: the versioned <code>.so.N.N</code>. This split is why <code>ldconfig</code> cannot fix <code>cannot find -lfoo</code> — the file the linker wants does not exist on the system, and no amount of refreshing a cache will invent it.",
          "<strong>pkg-config</strong> is the resolver for build-time metadata. <code>pkg-config --cflags --libs libcurl</code> reads <code>libcurl.pc</code>, which declares the include directories and the libraries, and prints them. It also checks versions, which is the whole point: <code>--atleast-version=</code> and <code>--exists</code> let a build refuse to proceed against the wrong library. Two Ubuntu packages ship a <code>libcurl4.pc</code> with the same name and different contents — <code>libcurl4-gnutls-dev</code> and <code>libcurl4-openssl-dev</code> — and installing the wrong one gives you a link error about SSL symbols rather than an obvious error about packages. <code>pkg-config --modversion libcurl</code> disambiguates.",
          "One Debian-specific gotcha worth knowing: <code>pkg-config</code> on Debian strips the default <code>-I/usr/include</code> from its output, so a library's <code>Cflags</code> look suspiciously short. That is deliberate — it prevents a build from accidentally picking up a header outside the dependency chain — and <code>PKG_CONFIG_ALLOW_SYSTEM_CFLAGS=1</code> restores the old behaviour when you genuinely need it.",
          "<strong>The X.h loop</strong> is this: the compiler says <code>fatal error: curl/curl.h: No such file or directory</code>; you install a package that seemed right; you rebuild; the compiler says <code>fatal error: openssl/ssl.h: No such file or directory</code>; you install another; the linker now says <code>undefined reference to 'curl_easy_init'</code>. Each step is correct and you converge only when you stop guessing. The closed loop is: read the header path from the error, find the owning package with <code>apt-file search</code> (install it and run <code>apt-file update</code> once — it maintains a separate index that is not populated by default), install the <code>-dev</code> package for <em>that</em> header, then <code>pkg-config --exists</code> to confirm the metadata is actually there, and only then rebuild. On a multiarch system, note that libc's own headers are in <code>/usr/include/x86_64-linux-gnu/sys/</code>, so a hand-rolled <code>-I/usr/include</code> is not the same as not passing <code>-I</code> at all."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The full missing-header workflow, start to finish, without guessing",
        code: `# 0. what does the error actually name?
$ make
main.c:4:10: fatal error: sqlite3.h: No such file or directory
    4 | #include <sqlite3.h>
      |          ^~~~~~~~~~

# 1. do you already own it somewhere unusual?
$ dpkg -S '*/sqlite3.h'              # if this prints nothing, you do not have it
$ find /usr/include -name sqlite3.h 2>/dev/null

# 2. build the apt-file index ONCE, then search it. this is the step people skip.
$ sudo apt-get install apt-file
$ sudo apt-file update                 # separate index, several MB, not in apt's normal cache
$ apt-file search sqlite3.h
usr/include/sqlite3.h: devel package for SQLite 3 database engine
# → libsqlite3-dev

# 3. install the -dev package and confirm the metadata, not just the file
$ sudo apt-get install libsqlite3-dev
$ pkg-config --modversion sqlite3 && pkg-config --cflags --libs sqlite3
3.27.2
-I/usr/include -lsqlite3
#   a -dev package with no .pc file is normal; that is fine, -lsqlite3 still works.
#   a .pc file pointing at a library that is NOT installed is the classic
#   "compiles fine, then undefined reference at link time" bug.

# 4. the alternate spelling problem
$ apt-cache search libcurl4 | grep dev
libcurl4-gnutls-dev    - easy-to-use client-side curl and FTP library libraries (OpenSSL flavor)
libcurl4-openssl-dev   - easy-to-use client-side curl and FTP library libraries (GnuTLS flavor)
$ apt-file search curl/curl.h | head
# both provide it. choose with:  apt-cache policy libcurl4-openssl-dev
# and confirm with:                pkg-config --modversion libcurl && pkg-config --libs libcurl

# 5. before you rebuild, look at where the compiler is actually searching
$ gcc -E -Wp,-v -xc /dev/null 2>&1 | sed -n '/search starts here/,/End of search/p'
# /usr/lib/gcc/x86_64-linux-gnu/7/include
# /usr/local/include
# /usr/include/x86_64-linux-gnu
# /usr/include
# End of search list.
# notice there is no -I anywhere: if your project adds -I/usr/include explicitly it has
# CHANGED the search order, which silently removes the multiarch directory.

# 6. clean rebuild. a stale object from before the -dev package existed will not
#    be recompiled, and you will conclude the header is still missing.
$ make clean && make -j"$(nproc)"`
      },
      {
        type: "callout",
        kind: "tip",
        title: "The three checks that would have prevented most build hours",
        text: "Run <code>gcc -### file.c -o file</code> before anything else: it prints the real compiler, the real flags and the real subprocess commands without executing them, so a wrong <code>CC</code>, a missing <code>-fPIC</code> or a mangled <code>CFLAGS</code> is visible in one second. Run <code>readelf -d</code> on the output before you ship it: it shows whether your <code>RUNPATH</code> is what you intended and whether <code>--as-needed</code> silently dropped a library you meant to link. And run <code>make clean</code> before every rebuild after installing a <code>-dev</code> package, because make will happily reuse an object compiled against the headers that were missing before, and you will debug the wrong thing."
      },
      {
        type: "kv",
        items: [
          { k: "DESTDIR", v: "A staging root prefixed to every install path. It is not a chroot and does not affect paths compiled into the binary. It is the only reason a package can be built by an unprivileged user without touching the host." },
          { k: "--sysconfdir / --localstatedir", v: "The two flags that are <em>never</em> correct at their defaults when <code>--prefix=/usr</code>, because the defaults derive from the prefix and produce <code>/usr/etc</code> and <code>/usr/var</code>. Both must be set explicitly." },
          { k: "--as-needed", v: "The Ubuntu default. A <code>-l</code> whose symbols were already satisfied is dropped from <code>DT_NEEDED</code>, which is why a library you linked can be absent from <code>ldd</code> output." },
          { k: "-fPIC / -fPIE", v: "Position-independent code for shared libraries; position-independent executables for programs. Ubuntu defaults to <code>-fPIE -pie</code>, which does <em>not</em> imply <code>-fPIC</code> for anything you build into a <code>.so</code>." },
          { k: "fakeroot", v: "An LD_PRELOAD shim that makes ownership-setting syscalls succeed without privileges, so the staged tree has correct uid/gid in the archive. Not a security tool; never use it to bypass anything that matters." },
          { k: "RUNPATH vs RPATH", v: "RUNPATH is searched after <code>LD_LIBRARY_PATH</code> and applies only to direct dependencies; RPATH is searched before it and applies transitively. RUNPATH is the modern default." },
          { k: "SONAME", v: "The name a shared library answers to — <code>libfoo.so.1</code> — as distinct from the file on disk, <code>libfoo.so.1.2.3</code>. Keeping the SONAME across versions is what makes in-place library upgrades safe." },
          { k: "relink / restart requirement", v: "A running process has already mapped its libraries; the loader is never consulted again for them. That is why a library upgrade does not affect running processes — and why a <code>dlopen</code> after the upgrade can pick up a different one." },
          { k: "toolchain triple", v: "<code>target-vendor-os[-abi]</code>, e.g. <code>aarch64-linux-gnu</code>. It is a naming agreement across gcc, as and ld, not just a label." },
          { k: "PKG_CONFIG_LIBDIR", v: "Which <code>.pkgconfig</code> directories are visible. In a cross build it must point at the target sysroot, or pkg-config returns host include paths and you compile target code against host headers." }
        ]
      }
    ],
    takeaways: [
      "Preprocess, compile, assemble, link, install — and a binary package ships you the first four already done. <code>gcc -###</code> shows the real subprocess commands; <code>make DESTDIR</code> is the only stage that runs on your machine.",
      "Linking happens twice. At build time the linker records what it could not resolve in <code>DT_NEEDED</code>; at run time <code>ld.so</code> actually finds it. 'error while loading shared libraries' is the second one failing, not the first.",
      "A running process keeps its mapped libraries after an upgrade, because the new file is a new inode. Truncating a library in place instead of replacing it kills every process using it with SIGBUS.",
      "<code>--prefix=/usr</code> must be paired with <code>--sysconfdir=/etc</code> and <code>--localstatedir=/var</code>. The defaults derive from the prefix and will silently put your config in <code>/usr/etc</code>.",
      "DESTDIR stages installs and nothing else. It does not fix a wrong prefix, does not run ldconfig, does not create system state, and is not a chroot — four things people assume it does.",
      "CMake's <code>CMakeCache.txt</code> is the reason your flags 'do not apply'. Meson has no equivalent problem because it is declarative. In both, the inspect command is faster than guessing.",
      "Static linking trades security updates and memory sharing for portability. Dynamic linking is correct for a managed server; <code>RUNPATH</code> ordering is the detail that explains most 'it works on my machine' library bugs.",
      "<code>/usr/local</code> means 'not owned by the packaging system'. Anything that should still exist in three years belongs in a package or a versioned <code>/opt</code> directory with the build flags in the repository next to it."
    ],
    glossary: {
      "preprocess": "Stage one, done by cpp. Expands includes and macros; knows nothing about C. A missing header is a preprocessing error, not a compiler error.",
      "cc1 / collect2 / as / ld": "The actual programs behind gcc: cc1 compiles, as assembles, and the driver calls collect2 which calls ld to link. gcc itself mostly selects options and orders the calls.",
      "object file": "The .o produced by the assembler. It contains sections, a symbol table and relocations, and its undefined symbols are promises the linker must keep.",
      "DT_NEEDED": "The dynamic-section entry naming a shared object the file needs resolved at run time.",
      "SONAME": "The name a shared library answers to, such as libfoo.so.1, as distinct from the file libfoo.so.1.2.3 on disk.",
      "RPATH / RUNPATH": "Search paths baked into the ELF. RPATH is searched before LD_LIBRARY_PATH and applies transitively; RUNPATH is searched after it and applies only to direct dependencies.",
      "ldconfig": "The program that reads /etc/ld.so.conf.d and writes the hashed /etc/ld.so.cache that ld.so consults. It can only help if the directory is already listed.",
      "DESTDIR": "A staging root prefixed to every installation path, applied by make install only. It makes unprivileged, host-free builds possible; it does not affect paths compiled into the binary.",
      "fakeroot": "An LD_PRELOAD shim that intercepts chown and friends so a build believes it ran as root without doing so. Needed for correct uid/gid in a hand-built package.",
      "--as-needed": "A linker default on Ubuntu that drops a -l library from DT_NEEDED if none of its symbols were actually used.",
      "-fno-common": "A gcc 10-era default change that stopped merging tentative definitions in headers into .bss, causing widespread multiple-definition link failures in older third-party code.",
      "pkg-config": "Reads .pc files and emits the right -I and -l flags, and can check version constraints. The usual reason a build finds the wrong library is two -dev packages shipping the same .pc name.",
      "toolchain triple": "target-vendor-os[-abi], for example aarch64-linux-gnu. A naming agreement across gcc, as and ld, not just a label.",
      "--sysroot": "Tells gcc where the target's headers and libraries live. Does not redirect the compiler's own runtime bits, which is why the linker often needs it passed as well.",
      "buildsystem=meson": "The debhelper directive that makes debian/rules drive meson instead of make, alongside autotools, cmake and ninja.",
      "DT_INTERP / PT_INTERP": "The ELF segment naming the dynamic loader. Its presence is the definition of a dynamically linked binary, and it is why _start runs before main."
    }
  });
})();