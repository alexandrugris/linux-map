/* ch01 — Boot: from power to a shell */
(function () {
  LX.push({
    id: "boot",
    title: "Boot: from power-on to a shell",
    tagline: "Everything the machine does before you can type, and the five places it can stop doing it.",
    sections: [
      {
        type: "prose",
        h: "The sequence",
        p: [
          "Booting is a chain of increasingly capable programs handing control forward. Each stage knows less about your intentions than the one that follows, and each can only hand over what it has. Understanding the order matters mostly because it tells you <em>which layer to blame</em> when the machine does not come up — and, on a remote box you reach only over SSH, it tells you which failures you cannot fix remotely at all.",
          "The chain is: <strong>firmware → bootloader → kernel → initramfs → init (systemd) → targets → your login</strong>. Nothing before the kernel is Linux. On a KVM VPS the “firmware” is an emulated UEFI ROM inside the hypervisor; the moment you see the provider's own boot menu instead of GRUB, you are looking at firmware, not your operating system."
        ]
      },
      {
        type: "diagram",
        h: "The boot chain, and where each stage fails",
        caption: "Each box is a different program with a different amount of authority. Note the two shaded rows at the bottom: those are the stages that happen <b>before</b> systemd can rescue you, which is why a broken initramfs on a remote VPS needs the provider's console rather than a reboot.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="Boot chain from firmware through bootloader, kernel, initramfs, systemd, to login">
  <!-- stage labels -->
  <line class="ln" x1="188" y1="40" x2="188" y2="668"/>
  <text class="t-dim" x="176" y="56" font-size="13" text-anchor="end" transform="rotate(-90 176 56)"></text>

  <!-- 1 hardware -->
  <g>
  <rect class="box" x="30" y="34" width="150" height="62" rx="10"/>
  <text x="48" y="60" font-size="14.5">Power on</text>
  <text class="t-xs" x="48" y="78">CPU reset, RAM</text>
  <text class="t-xs" x="48" y="92">self-test</text>
  </g>
  <path class="ln-a" d="M180,65 L222,65" marker-end="url(#lm-arrow-accent)"/>

  <!-- 2 firmware -->
  <g>
  <rect class="box-w" x="222" y="34" width="170" height="62" rx="10"/>
  <text class="t-warn" x="240" y="60" font-size="14.5">Firmware</text>
  <text class="t-xs" x="240" y="78">UEFI: pick device,</text>
  <text class="t-xs" x="240" y="92">init .efi, Secure Boot</text>
  </g>
  <path class="ln-a" d="M392,65 L434,65" marker-end="url(#lm-arrow-accent)"/>

  <!-- 3 bootloader -->
  <g>
  <rect class="box-w" x="434" y="34" width="170" height="62" rx="10"/>
  <text class="t-warn" x="452" y="60" font-size="14.5">GRUB2</text>
  <text class="t-xs" x="452" y="78">reads /etc/default/grub,</text>
  <text class="t-xs" x="452" y="92">menu, loads vmlinuz+initrd</text>
  </g>
  <path class="ln-a" d="M604,65 L646,65" marker-end="url(#lm-arrow-accent)"/>

  <!-- 4 kernel -->
  <g>
  <rect class="box-a" x="646" y="34" width="170" height="62" rx="10"/>
  <text class="t-accent" x="664" y="60" font-size="14.5">Kernel</text>
  <text class="t-xs" x="664" y="78">decompress, probe</text>
  <text class="t-xs" x="664" y="92">hardware, start PID 1</text>
  </g>
  <path class="ln-a" d="M816,65 L858,65" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="858" y="34" width="212" height="62" rx="10"/>
  <text class="t-accent" x="876" y="60" font-size="14.5">/proc and /sys mount</text>
  <text class="t-xs" x="876" y="78">kernel brings up its own</text>
  <text class="t-xs" x="876" y="92">filesystem view</text>
  </g>

  <!-- 5 initramfs -->
  <g>
  <rect class="box-b" x="222" y="130" width="848" height="96" rx="10"/>
  <text class="t-bad" x="242" y="158" font-size="15">initramfs — a whole root filesystem unpacked into RAM (a compressed cpio archive)</text>
  <text class="t-xs" x="242" y="180">Contains: udev, a handful of tools (busybox or coreutils), and the modules needed to reach the real root disk:</text>
  <text class="t-xs" x="242" y="198">virtio / nvme / e1000 / sd_mod / xhci, the storage controller driver, the filesystem driver (ext4, xfs…), and crypto.</text>
  <text class="t-xs" x="242" y="220">It mounts the real root, hands /dev and /proc to systemd, and <tspan font-weight="700">execs systemd</tspan>. If it cannot, you get a maintenance shell and a machine that will never reach sshd.</text>
  <text class="t-warn" x="242" y="240" font-size="13">classic failure: “ALERT! /dev/mapper/… does not exist” or “Unable to mount root fs” — the modules inside the initramfs do not match this kernel or this disk.</text>
  </g>
  <path class="ln-b" d="M700,96 L700,130" marker-end="url(#lm-arrow-bad)"/>

  <!-- 6 systemd -->
  <g>
  <rect class="box-ok" x="222" y="252" width="400" height="92" rx="10"/>
  <text class="t-ok" x="242" y="280" font-size="15">systemd becomes PID 1</text>
  <text class="t-xs" x="242" y="300">reads /etc/systemd/system, units, sockets,</text>
  <text class="t-xs" x="242" y="316">timers, credentials; mounts the API fs;</text>
  <text class="t-xs" x="242" y="332">starts the base.target dependency tree</text>
  </g>
  <g>
  <rect class="box-ok" x="646" y="252" width="424" height="92" rx="10"/>
  <text class="t-ok" x="664" y="280" font-size="15">default target reached</text>
  <text class="t-xs" x="664" y="300">graphical.target (desktop) or multi-user.target (server).</text>
  <text class="t-xs" x="664" y="316">On your VPS: multi-user.target → sshd.socket is already listening</text>
  <text class="t-xs" x="664" y="332">→ so port 22 accepts connections before sshd has even been exec'd.</text>
  </g>
  <path class="ln-ok" d="M422,344 L422,382" marker-end="url(#lm-arrow-ok)"/>

  <!-- 7 login -->
  <g>
  <rect class="box-v" x="222" y="382" width="400" height="86" rx="10"/>
  <text class="t-violet" x="242" y="410" font-size="15">getty / login</text>
  <text class="t-xs" x="242" y="430">PAM verifies the password or the key,</text>
  <text class="t-xs" x="242" y="446">pam_systemd opens a session scope cgroup,</text>
  <text class="t-xs" x="242" y="462">profiles, limits, env vars are loaded</text>
  </g>
  <g>
  <rect class="box-p" x="646" y="382" width="424" height="86" rx="10"/>
  <text class="t-bad" x="664" y="410" font-size="15">your shell</text>
    <text class="t-xs" x="664" y="430">bash/zsh is an ordinary child of sshd, inside a cgroup scope</text>
    <text class="t-xs" x="664" y="446">loginctl shows the session · journalctl --user shows your logs</text>
    <text class="t-xs" x="664" y="462">systemd will SIGTERM the whole scope when you log out or the session times out</text>
  </g>
  <path class="ln-v" d="M422,468 L422,506" marker-end="url(#lm-arrow)"/>

  <!-- 8 steady state -->
  <g>
  <rect class="box-a" x="222" y="506" width="848" height="72" rx="10"/>
  <text class="t-accent" x="242" y="534" font-size="15">steady state</text>
  <text class="t-xs" x="242" y="554">systemd is no longer “starting things” — it is now continuously: restarting failed units, running timers, reaping children,</text>
  <text class="t-xs" x="242" y="570">logging, and re-establishing socket-activated services. That switch from “boot loader” to “supervisor” is the whole point of PID 1.</text>
  </g>

  <!-- annotations -->
  <rect class="box-w" x="30" y="130" width="170" height="96" rx="10"/>
  <text class="t-warn" x="46" y="158" font-size="13.5">kill zones</text>
  <text class="t-xs" x="46" y="180">A bad /etc/fstab, a missing</text>
  <text class="t-xs" x="46" y="196">initramfs, a bad grub.cfg,</text>
  <text class="t-xs" x="46" y="212">an unbootable kernel.</text>
  <text class="t-xs" x="46" y="230">These need a console.</text>

  <rect class="box-b" x="30" y="252" width="170" height="150" rx="10"/>
  <text class="t-bad" x="46" y="280" font-size="13.5">rescue paths</text>
  <text class="t-xs" x="46" y="302">GRUB menu → ‘e’ to edit</text>
  <text class="t-xs" x="46" y="318">the kernel line, add:</text>
  <text class="t-warn" x="46" y="340">systemd.unit=rescue.target</text>
  <text class="t-warn" x="46" y="358">systemd.unit=emergency.target</text>
  <text class="t-xs" x="46" y="378">…then Ctrl-X. Needs the</text>
  <text class="t-xs" x="46" y="394">provider console.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Firmware and the bootloader, briefly",
        p: [
          "<strong>BIOS</strong> reads the first sector of the disk (446 bytes of assembly) and chains to the next stage. It knows nothing about partitions or filesystems, which is why it can boot a disk it cannot itself read. <strong>UEFI</strong> replaces that with a small OS loaded from an <abbr title='Extensible Firmware Interface'>/EFI</abbr> partition — a FAT filesystem that holds <code>*.efi</code> bootloaders, which is why an ESP is mandatory for UEFI boot and why “boot mode: UEFI vs legacy/CSM” is a real setting on a VPS console with a disk that suddenly will not boot.",
          "<strong>GRUB</strong> is that first-stage program. It reads <code>/etc/fstab</code> and <code>/etc/default/grub</code> to find <code>/boot</code>, shows a menu (suppressed by <code>GRUB_TIMEOUT=0</code>, which is why a VPS appears to boot instantly and then suddenly shows you a menu — someone changed it), and loads <code>vmlinuz</code> plus <code>initrd.img</code> into memory and jumps.",
          "If <code>grub-mkconfig</code> was never re-run after installing a kernel, GRUB keeps offering the old <code>vmlinuz</code> that you just deleted. The symptom is specific and memorable: a machine that booted yesterday refuses today with <em>error: file '/boot/vmlinuz-&lt;old-version&gt;' not found</em>. The fix is one command from a rescue shell: <code>grub-mkconfig -o /boot/grub/grub.cfg</code>."
        ],
        noteTitle: "UEFI, Secure Boot and third-party kernel modules",
        note: "Secure Boot verifies signatures against the firmware's key store. It does not stop a kernel <em>module</em> loaded after boot — so it protects the chain, not the running system. On a VPS with Secure Boot on, out-of-tree modules (zfs, nvidia, some storage drivers) will refuse to load with <code>Key was rejected by service</code> unless you sign them (MOK/enroll) or disable it. Always check <code>mokutil --sb-state</code> before blaming a module.",
        noteKind: "fact"
      },
      {
        type: "prose",
        h: "The kernel command line",
        p: ["You can see every argument the kernel was given, from any machine, at any time:",
          "<code>cat /proc/cmdline</code>. It is worth knowing by heart on a VPS, because these are the knobs that decide whether the network works at all. The entries below cause the majority of “the network is down after a reboot” incidents — and every one of them is invisible until the next reboot, which is why it is also the answer to “it worked for weeks and then broke overnight”."],
        kv: {
          h: "The arguments that actually change behaviour",
          items: [
            { k: "root=UUID=…", v: "Which device is the root filesystem. Missing or wrong = <code>Unable to mount root fs</code> and an initramfs shell. Prefer UUID over <code>/dev/sda1</code>, because disk enumeration order changes when you add a disk." },
            { k: "ro / rw", v: "Mount root read-only first (almost always <code>ro</code>), then remounted rw by systemd after the initramfs is gone. This is what lets crash recovery be safe." },
            { k: "console=ttyS0,115200", v: "Where kernel messages go on a headless box. <strong>Essential on a VPS</strong>: without it, a panic message goes to a console you cannot see." },
            { k: "net.ifnames=0", v: "Turns off predictable interface names — <code>eth0</code> instead of <code>ens3</code>. Affects firewall rules, netplan and any interface name you hardcoded." },
            { k: "systemd.unified_cgroup_hierarchy=0", v: "Forces cgroups v1 on a kernel that supports v2. This is exactly the kind of change that makes a systemd version and a kernel version disagree about paths." },
            { k: "mitigations=off / =auto", v: "CPU vulnerability mitigations. On older cloud CPUs, <code>off</code> can be a large performance win; it is also a real security decision, not a free optimisation." },
            { k: "systemd.unit=", v: "Boot into a different target — <code>rescue.target</code>, <code>emergency.target</code>, <code>multi-user.target</code>. The single most useful rescue tool, and it works from the GRUB menu." },
            { k: "systemd.mask=unit", v: "Prevent a unit from starting at all. Useful to bisect a boot failure without editing files you cannot see." }
          ]
        }
      },
      {
        type: "prose",
        h: "The initramfs: the part that surprises people",
        p: [
          "The kernel cannot mount <code>/</code> without a filesystem driver, and on modern hardware it cannot even <em>see</em> the disk without a driver. Neither is compiled into the kernel: they are modules. So the bootloader loads a second archive — the <strong>initramfs</strong> — which is a complete miniature root filesystem in a RAM disk, containing udev plus exactly the modules needed to find the real root device and mount it.",
          "That archive is regenerated <strong>every time a kernel is installed</strong>, by <code>update-initramfs</code> (Debian/Ubuntu) or <code>dracut</code> (Fedora/Arch), driven by <code>/etc/initramfs-tools/modules</code> and hooks. On a normal machine it just works, because the tool inspects your current root filesystem and includes what it needs. The failures are all of the form <em>“the thing I just installed is not in the initramfs”</em>: a root filesystem on an unusual device, a disk on a controller whose driver lives in the archive, an encrypted volume whose modules were never listed.",
          "When an initramfs fails you land in a <code>(initramfs)</code> shell with BusyBox commands and <code>/root</code> holding the kernel log. The useful moves are <code>cat /root/initramfs-debug.log</code>, <code>ls /dev/disk/by-uuid/</code> to see what the archive actually found, <code>modprobe &lt;driver&gt;</code> to add a driver by hand, and <code>mount -o ro /dev/sdX2 /root</code> to find out whether the filesystem is the problem rather than the driver.",
          "On a KVM guest the standard set is tiny — <code>virtio_pci</code>, <code>virtio_blk</code>, <code>ext4</code> — and Debian's initramfs-tools handles it automatically. The trap specific to VPS resizes is that after growing the virtual disk you need <code>growpart</code> and <code>resize2fs</code> (or <code>xfs_growfs</code>), and the partition table, not the kernel, is what is stale."
        ]
      },
      {
        type: "diagram",
        h: "What systemd actually does at boot",
        caption: "systemd does not run a startup script. It loads a <b>dependency graph of units</b>, starts them in parallel wherever the graph allows, and separates <b>ordering</b> (After=/Before=) from <b>dependency</b> (Requires=/Wants=). A unit that is Wanted but not Required does not stop boot when it fails — which is why a broken optional service is a warning and a broken Required one is a rescue prompt.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="systemd target dependency graph at boot">
  <text class="t-title" x="30" y="34">default.target  →  multi-user.target  (a server)</text>

  <rect class="box-ok" x="390" y="52" width="200" height="44" rx="9"/>
  <text class="t-ok" x="490" y="80" text-anchor="middle" font-size="15">multi-user.target</text>

  <path class="ln-ok" d="M430,96 L150,150" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M470,96 L350,150" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M540,96 L560,150" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M580,96 L770,150" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M610,96 L950,150" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-a" x="60" y="150" width="180" height="44" rx="9"/>
  <text class="t-sm" x="150" y="177" text-anchor="middle">local-fs.target</text>
  <rect class="box-a" x="260" y="150" width="180" height="44" rx="9"/>
  <text class="t-sm" x="350" y="177" text-anchor="middle">swap.target</text>
  <rect class="box-a" x="460" y="150" width="180" height="44" rx="9"/>
  <text class="t-sm" x="550" y="177" text-anchor="middle">basic.target</text>
  <rect class="box-a" x="680" y="150" width="180" height="44" rx="9"/>
  <text class="t-sm" x="770" y="177" text-anchor="middle">sysinit.target</text>
  <rect class="box-a" x="880" y="150" width="180" height="44" rx="9"/>
  <text class="t-sm" x="970" y="177" text-anchor="middle">network.target</text>

  <text class="t-xs" x="30" y="222">Units below these targets (excerpt from a real Ubuntu 18.04 server):</text>

  <rect class="box" x="30" y="238" width="230" height="132" rx="9"/>
  <text class="t-sm" x="46" y="262">sysinit.target</text>
  <text class="t-xs" x="46" y="284">systemd-journald.service</text>
  <text class="t-xs" x="46" y="302">systemd-udevd.service</text>
  <text class="t-xs" x="46" y="320">systemd-udev-trigger.service</text>
  <text class="t-xs" x="46" y="338">systemd-tmpfiles-setup.service</text>
  <text class="t-xs" x="46" y="356">systemd-sysusers.service</text>

  <rect class="box" x="285" y="238" width="230" height="132" rx="9"/>
  <text class="t-sm" x="301" y="262">local-fs.target</text>
  <text class="t-xs" x="301" y="284">-.mount (every fstab entry)</text>
  <text class="t-xs" x="301" y="302">systemd-remount-fs.service</text>
  <text class="t-xs" x="301" y="320">systemd-fsck@.service (per fs)</text>
  <text class="t-xs" x="301" y="338">boot.mount → /boot</text>
  <text class="t-xs" x="301" y="356">dev-mapper-*.mount (LVM)</text>

  <rect class="box" x="540" y="238" width="250" height="132" rx="9"/>
  <text class="t-sm" x="556" y="262">services that “just work”</text>
  <text class="t-xs" x="556" y="284">systemd-resolved.service</text>
  <text class="t-xs" x="556" y="302">ufw.service (firewall rules)</text>
  <text class="t-xs" x="556" y="320">cron.service</text>
  <text class="t-xs" x="556" y="338">nginx.service / named.service</text>
  <text class="t-xs" x="556" y="356">ssh.service, docker/containerd</text>

  <rect class="box-v" x="815" y="238" width="255" height="132" rx="9"/>
  <text class="t-violet" x="831" y="262">sockets: why ssh works early</text>
  <text class="t-xs" x="831" y="284">sshd.socket  (WantedBy=sockets.target)</text>
  <text class="t-xs" x="831" y="302">└─ ListenStream=0.0.0.0:22</text>
  <text class="t-xs" x="831" y="320">sshd.service @sshd.service</text>
  <text class="t-xs" x="831" y="338">└─ only exec'd when a connection</text>
  <text class="t-xs" x="831" y="356">   actually arrives</text>

  <rect class="box-w" x="30" y="396" width="520" height="140" rx="9"/>
  <text class="t-warn" x="46" y="420" font-size="14.5">Ordering vs dependency — the distinction that explains most systemd mysteries</text>
  <text class="t-sm" x="46" y="444">After=/Before=   → sequence.  “B must be started after A”, nothing more. B may fail without touching A.</text>
  <text class="t-sm" x="46" y="464">Requires=/Wants= → dependency. If a <tspan font-weight="700">Required</tspan> unit fails to start, this one is not started either.</text>
  <text class="t-sm" x="46" y="484">WantedBy=/RequiredBy= → the inverse: what pulls this unit into a target.</text>
  <text class="t-xs" x="46" y="508">Hence: multi-user.target <tspan font-weight="700">Wants</tspan> sshd.service but does not Require it — one dead service never stops the boot.</text>
  <text class="t-xs" x="46" y="526">But if a <tspan font-weight="700">local-fs.target</tspan> mount fails, boot drops to emergency.target, because nothing can proceed.</text>

  <rect class="box-b" x="575" y="396" width="495" height="140" rx="9"/>
  <text class="t-bad" x="591" y="420" font-size="14.5">The recovery targets, and when you need them</text>
  <text class="t-sm" x="591" y="444">rescue.target   — one user’s filesystem, no services. First stop for “boots but nothing works”.</text>
  <text class="t-sm" x="591" y="464">emergency.target — <tspan font-weight="700">only</tspan> root’s shell, no mounts, no networking, no editor.</text>
  <text class="t-sm" x="591" y="484">multi-user.target — force the normal path from a rescue shell.</text>
  <text class="t-xs" x="591" y="508">All three are reachable from the GRUB menu by editing the kernel line and appending</text>
  <text class="t-warn" x="591" y="526">systemd.unit=rescue.target — which requires the provider’s serial console, not SSH.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Boot diagnosis — the order to run these, and what each one tells you",
        code:
`# 1. what exactly did this boot do, in order, with timings
systemd-analyze
systemd-analyze blame                 # which unit cost the most wall-clock
systemd-analyze critical-chain ssh.service
systemd-analyze verify                 # warns about unused/dead directives in units

# 2. the units that failed — this is the single most useful boot command
systemctl --failed
systemctl status <unit> --no-pager -l

# 3. the kernel's own view of this boot (not the journal — the kernel ring buffer)
journalctl -k -b -p warning
journalctl -b -1 -k        # the PREVIOUS boot: why did it reboot? (oops, timeout, panic)

# 4. what the kernel was given
cat /proc/cmdline
cat /proc/version

# 5. is the boot itself what you asked for?
systemctl get-default
systemctl list-dependencies multi-user.target
systemctl cat nginx                    # unit + every drop-in, merged

# 6. filesystem health (why a mount was skipped or a fsck ran)
systemctl status "$(findmnt -n -o SOURCE /)" 2>/dev/null | head -20
journalctl -b -u systemd-fsck@\\x2f.service`

      },
      {
        type: "callout",
        kind: "warn",
        title: "The boot lesson that costs the most when it is ignored",
        text: "Everything in the first three rows of the diagram — firmware, GRUB, the kernel, the initramfs — happens <b>before</b> a single one of your services exists, and most of it happens before <b>SSH exists</b>. On a box you can only reach over SSH, a failure in that band is not a troubleshooting problem, it is a console problem: the provider's web VNC, IPMI, or a physical keyboard. Know in advance which console your VPS has and whether you have tested it. On your own server the recovery band is narrower — Tailscale comes up as part of <code>multi-user.target</code>, so if boot stalls earlier, the tunnel does not exist either."
      },
      {
        type: "prose",
        h: "What happens when you log in",
        p: [
          "The last stage of boot is a login, and it is more layered than it looks. When an SSH connection arrives, either <code>sshd.socket</code> wakes <code>sshd.service</code> or the persistent <code>sshd</code> accepts; either way the authentication chain is <strong>PAM</strong> — a stack of pluggable modules (<code>pam_unix</code>/<code>pam_systemd</code>, <code>pam_limits</code>, <code>pam_env</code>) that owns the password check, the resource limits, the environment and, critically, <em>the session accounting</em>.",
          "<code>pam_systemd</code> is the piece worth knowing. On success it calls <code>logind</code>, which creates a <strong>session</strong>, opens a <code>session-N.scope</code> cgroup, applies the user's configured resource limits, and starts the user's <code>user@N.service</code> instance. Your shell and everything it spawns are now inside that scope, and <strong>that</strong> is why <code>loginctl</code> can show you a session, why <code>KillUser=</code> can log you out remotely, why <code>systemctl --user</code> works in your shell, and why lingering (<code>loginctl enable-linger</code>) lets your services run with nobody logged in — which is exactly how a gateway survives a reboot on a headless box.",
          "If you want to see this rather than read it: log in over SSH, then from a second session run <code>loginctl list-sessions</code> and <code>systemctl status session-N.scope</code>. The whole tree — your sshd, your shell, its children — is visible as one cgroup. Everything in chapter 06 depends on this being true."
        ]
      }
    ],
    takeaways: [
      "The chain is firmware → bootloader → kernel → initramfs → systemd → login. Each stage knows less than the next, and each can only pass on what it has.",
      "The kernel needs <strong>modules</strong> to see your disk and mount it, which is why the initramfs exists and why \"I installed something and it won't load\" is an initramfs problem.",
      "<code>cat /proc/cmdline</code> is the single most revealing command on a broken machine — interface names, console, root device and rescue target all live there.",
      "systemd is a <strong>dependency graph</strong>, not a script. Ordering (<code>After=</code>) is separate from dependency (<code>Requires=</code>); that is why one failed optional service does not stop a boot.",
      "Socket activation means <code>sshd.socket</code> holds port 22 before <code>sshd</code> exists — the first thing to check when a service is \"not running\" but connections still succeed.",
      "A login creates a session <em>scope</em> cgroup through PAM. Your shell and everything under it live there, and systemd can kill the lot."
    ],
    glossary: {
      "UEFI": "Unified Extensible Firmware Interface — the firmware standard that boots from an EFI System Partition, replacing the 16-bit BIOS.",
      "ESP": "EFI System Partition — a small FAT32 partition holding the *.efi bootloader. Mandatory for UEFI boot.",
      "Secure Boot": "Firmware verification of the boot chain against a key store. It does not restrict modules loaded after boot.",
      "GRUB": "GRand Unified Bootloader — the usual Linux bootloader; reads its config, shows a menu and loads kernel + initramfs.",
      "initramfs / initrd": "A compressed cpio archive unpacked into RAM at boot, containing udev and the modules needed to mount the real root filesystem.",
      "initrd.img": "Debian/Ubuntu's initramfs image file, regenerated by update-initramfs on every kernel install.",
      "dracut": "Fedora/Arch's equivalent of initramfs-tools. If a machine has both, check which one the bootloader is loading.",
      "kernel command line": "The arguments the kernel booted with, visible in /proc/cmdline. Interface naming, console, root device and rescue targets all come from here.",
      "target": "A systemd unit that groups other units and represents a boot stage: multi-user.target, graphical.target, rescue.target, emergency.target.",
      "getty": "The program that presents a login prompt on a TTY (agetty/getty) and, via PAM, starts a session for the user who logs in.",
      "PAM": "Pluggable Authentication Modules — the stack that authenticates a user and, via pam_systemd, creates the logind session and its cgroup scope.",
      "scope": "A systemd unit representing externally-created processes (a login session) so they can be tracked and limited like any other unit.",
      "lingering": "loginctl enable-linger keeps a user's manager running with no active session, so user services survive logout and reboot."
    }
  });
})();