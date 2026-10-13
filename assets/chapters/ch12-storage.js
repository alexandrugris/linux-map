/* ch12 — Block devices, filesystems, and the disk you are running out of */
(function () {
  LX.push({
    id: "storage",
    title: "Block devices, filesystems, and the disk you are running out of",
    tagline: "Four layers, each with its own failure mode; almost every storage outage is a mismatch between what one layer believes and what the next one is actually doing.",
    sections: [
      {
        type: "prose",
        h: "Four layers, and every one of them breaks on its own",
        p: [
          "A byte written to <code>/var/www/html/index.html</code> passes through four layers that have nothing to do with each other and are each allowed to fail independently. The <strong>block device</strong> is the kernel's view of the hardware: a queue of 512-byte sectors and a driver. The <strong>partition</strong> is a slice of that device described by a table at its first sector — it has no data of its own, it is purely a naming convention. The <strong>filesystem</strong> is a data structure living inside a partition, with a superblock at byte offset 1024 that says which filesystem it is. The <strong>mountpoint</strong> is a directory in the VFS tree that the kernel grafts onto that filesystem.",
          "The reason this matters is that each layer reports success to the layer above. The disk accepts the sectors, so the driver returns success, so the partition looks fine, so the filesystem journals the transaction, so <code>mount</code> succeeds — and your file is gone anyway, because you unmounted the wrong thing. Debugging storage is almost never about the hardware. It is about establishing which layer the disagreement is in, then reading the data out of that layer instead of guessing.",
          "On the reference box (<code>ubuntu-2gb-hel1-1</code>: Ubuntu 18.04.6, kernel 4.15.0-213, 19&nbsp;GB virtio volume, ext4 root, no LVM) the whole chain is <code>/dev/vda</code> (virtio-blk, the KVM guest's view of a volume on the host) → <code>/dev/vda1</code> (a single GPT partition) → <code>ext4</code> → <code>/</code>. Nothing is exotic. That is the point: the same four layers, the same four failure modes, on the cheapest box a provider will sell you."
        ],
        note: "warn",
        noteTitle: "A partition is not a device",
        noteKind: "warn",
        p: [
          "Partitioning buys you almost nothing today and costs you a layer of naming. What it still buys: the ability to keep different filesystems on the same disk (a separate <code>/var</code> so a runaway log cannot fill root, or a swap partition that is not on your root volume), a BIOS boot partition, and a clean place to put a backup image. On a 19&nbsp;GB cloud volume with no separate <code>/var</code> and no swap, one partition is the correct design."
        ]
      },
      {
        type: "diagram",
        h: "The chain, and the error each layer produces when it is the problem",
        caption: "Read the failure bottom-up: start at the layer whose error string you can actually see, then confirm with the tool for that layer. <b>lsblk</b> answers layer 1, <b>blkid</b> layer 3, <b>findmnt</b> layer 4 — and the kernel's own <code>/sys/block</code> tells you whether layer 1 exists at all.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Four stage storage chain from block device to partition to filesystem to mountpoint, each with its failure mode">
  <text class="t-title" x="40" y="34">THE CHAIN — and what the failure at each layer looks like</text>

  <rect class="box-a" x="40" y="60" width="230" height="132" rx="10"/>
  <text class="t-accent" x="58" y="88" font-size="16">1 - block device</text>
  <text class="t-sm" x="58" y="112">/dev/vda</text>
  <text class="t-sm" x="58" y="132">lsblk -f  ·  /sys/block</text>
  <text class="t-xs" x="58" y="156">driver + request queue.</text>
  <text class="t-xs" x="58" y="174">Speaks sectors, not bytes.</text>

  <rect class="box-a" x="310" y="60" width="230" height="132" rx="10"/>
  <text class="t-accent" x="328" y="88" font-size="16">2 - partition</text>
  <text class="t-sm" x="328" y="112">/dev/vda1</text>
  <text class="t-sm" x="328" y="132">lsblk  ·  fdisk -l  ·  blkid</text>
  <text class="t-xs" x="328" y="156">GPT or MBR table only.</text>
  <text class="t-xs" x="328" y="174">Zero bytes of its own.</text>

  <rect class="box-a" x="580" y="60" width="230" height="132" rx="10"/>
  <text class="t-accent" x="598" y="88" font-size="16">3 - filesystem</text>
  <text class="t-sm" x="598" y="112">ext4 / xfs / btrfs</text>
  <text class="t-sm" x="598" y="132">blkid  ·  tune2fs -l</text>
  <text class="t-xs" x="598" y="156">superblock at byte 1024.</text>
  <text class="t-xs" x="598" y="174">Owns inodes, blocks, journal.</text>

  <rect class="box-a" x="850" y="60" width="210" height="132" rx="10"/>
  <text class="t-accent" x="868" y="88" font-size="16">4 - mountpoint</text>
  <text class="t-sm" x="868" y="112">/  /var  /srv</text>
  <text class="t-sm" x="868" y="132">findmnt  ·  mount</text>
  <text class="t-xs" x="868" y="156">a directory in the VFS.</text>
  <text class="t-xs" x="868" y="174">A namespace decision.</text>

  <path class="ln-a" d="M272,126 L306,126" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M542,126 L576,126" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M812,126 L846,126" marker-end="url(#lm-arrow-accent)"/>

  <text class="t-sm t-dim" x="289" y="112" text-anchor="middle">table</text>
  <text class="t-sm t-dim" x="559" y="112" text-anchor="middle">sb</text>
  <text class="t-sm t-dim" x="829" y="112" text-anchor="middle">graft</text>

  <rect class="box-b" x="40" y="222" width="230" height="140" rx="10"/>
  <text class="t-bad" x="58" y="250" font-size="15">driver gone / device lost</text>
  <text class="t-xs" x="58" y="274">I/O error, dev vda,</text>
  <text class="t-xs" x="58" y="292">logical block 2048</text>
  <text class="t-xs" x="58" y="318">No /sys/block/vda, or</text>
  <text class="t-xs" x="58" y="336">dmesg full of resets.</text>

  <rect class="box-b" x="310" y="222" width="230" height="140" rx="10"/>
  <text class="t-bad" x="328" y="250" font-size="15">table stale or absent</text>
  <text class="t-xs" x="328" y="274">Partition table entries</text>
  <text class="t-xs" x="328" y="292">are not in sync with disk</text>
  <text class="t-xs" x="328" y="318">Typical after growing a</text>
  <text class="t-xs" x="328" y="336">cloud volume: table says</text>
  <text class="t-xs" x="328" y="354">5 GB, kernel says 19 GB.</text>

  <rect class="box-b" x="580" y="222" width="230" height="140" rx="10"/>
  <text class="t-bad" x="598" y="250" font-size="15">not this filesystem / damaged</text>
  <text class="t-xs" x="598" y="274">EXT4-fs error (device vda1):</text>
  <text class="t-xs" x="598" y="292">bad magic number in superblock</text>
  <text class="t-xs" x="598" y="318">or mount: /var: wrong</text>
  <text class="t-xs" x="598" y="336">fs type, bad option, or</text>
  <text class="t-xs" x="598" y="354">unrecognised superblock.</text>

  <rect class="box-b" x="850" y="222" width="210" height="140" rx="10"/>
  <text class="t-bad" x="868" y="250" font-size="15">namespace wrong / stale</text>
  <text class="t-xs" x="868" y="274">mount: /var: special</text>
  <text class="t-xs" x="868" y="292">device /dev/vdb does not</text>
  <text class="t-xs" x="868" y="318">exist — and now the box</text>
  <text class="t-xs" x="868" y="336">is in emergency.target</text>
  <text class="t-xs" x="868" y="354">after a reboot.</text>

  <line class="ln-w dash" x1="40" y1="392" x2="1060" y2="392" stroke-width="2"/>
  <text class="t-warn" x="40" y="416" font-size="15">below the filesystem, everything is one linear stream of I/O requests</text>

  <rect class="box" x="45" y="434" width="190" height="96" rx="10"/>
  <text class="t-sm" x="63" y="460">write(2)</text>
  <text class="t-xs" x="63" y="482">syscall -&gt; VFS -&gt; ext4</text>
  <text class="t-xs" x="63" y="502">copies into page cache,</text>
  <text class="t-xs" x="63" y="520">returns success</text>

  <rect class="box" x="250" y="434" width="190" height="96" rx="10"/>
  <text class="t-sm" x="268" y="460">page cache</text>
  <text class="t-xs" x="268" y="482">dirty pages, kernel</text>
  <text class="t-xs" x="268" y="502">flushes them back on a</text>
  <text class="t-xs" x="268" y="520">timer or under pressure</text>

  <rect class="box" x="455" y="434" width="190" height="96" rx="10"/>
  <text class="t-sm" x="473" y="460">blk-mq + I/O scheduler</text>
  <text class="t-xs" x="473" y="482">merges and reorders</text>
  <text class="t-xs" x="473" y="502">requests; cfq/deadline/</text>
  <text class="t-xs" x="473" y="520">mq-deadline on 4.15</text>

  <rect class="box" x="660" y="434" width="190" height="96" rx="10"/>
  <text class="t-sm" x="678" y="460">virtio-blk driver</text>
  <text class="t-xs" x="678" y="482">queues into shared</text>
  <text class="t-xs" x="678" y="502">virtqueues, kicks the</text>
  <text class="t-xs" x="678" y="520">virtio device</text>

  <rect class="box" x="865" y="434" width="190" height="96" rx="10"/>
  <text class="t-sm" x="883" y="460">host hypervisor</text>
  <text class="t-xs" x="883" y="482">KVM maps the queue to</text>
  <text class="t-xs" x="883" y="502">a file on the host or</text>
  <text class="t-xs" x="883" y="520">a network volume</text>

  <path class="ln" d="M237,482 L247,482" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M442,482 L452,482" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M647,482 L657,482" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M852,482 L862,482" marker-end="url(#lm-arrow)"/>

  <text class="t-xs t-dim" x="45" y="562">write() returning 0 means "in RAM", not "on the platter". That gap is where fsync() lives,</text>
  <text class="t-xs t-dim" x="45" y="582">and it is why a 19 GB cloud disk can lose the last seconds of a log on a hard reset.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Device names are a naming scheme, and the suffix is not decoration",
        p: [
          "<code>/dev/sda</code>, <code>/dev/nvme0n1</code> and <code>/dev/vda</code> are not three kinds of device. They are three <em>driver families</em> rendering a name differently, and the difference shows up exactly where you do not want it: in whether a partition gets a <code>p</code> suffix.",
          "The rule is not arbitrary. The kernel builds the partition node name by taking the parent disk's name and appending the partition number — but NVMe devices already end in a digit (<code>nvme0n1</code>), so <code>nvme0n1</code> + <code>1</code> would be ambiguous with <code>nvme0n11</code>. The kernel therefore inserts a <code>p</code>: <code>/dev/nvme0n1p1</code>. For <code>/dev/sda</code> and <code>/dev/vda</code> the parent name ends in a letter, so no separator is needed: <code>/dev/sda1</code>, <code>/dev/vda1</code>. Write <code>/dev/nvme0n11</code> instead of <code>/dev/nvme0n1p1</code> and you get a genuine <code>No such file or directory</code> that has cost real people an afternoon.",
          "Two more names you will meet. <code>md0</code> and friends are Linux software RAID assembled by the <code>md</code> driver from several block devices — it creates a device that behaves like a disk. <code>/dev/mapper/vg0-root</code> is the device-mapper name for LVM logical volume <code>root</code> in volume group <code>vg0</code>; device-mapper is the kernel's dm target layer, which is also what <code>cryptsetup</code>, <code>multipath</code> and thin provisioning sit on top of. On the reference box there is no LVM, so there is no <code>/dev/mapper</code> at all — an empty directory is the correct answer, not a broken install.",
          "Names are assigned at boot by discovery order and are not stable. If you hard-code <code>/dev/sdb</code> into <code>/etc/fstab</code> on a box with two disks, you will eventually mount the wrong filesystem after a re-enumeration. Use <code>UUID=</code> or <code>LABEL=</code> — see the fstab section below."
        ]
      },
      {
        type: "diagram",
        h: "Name anatomy across three driver families",
        caption: "The parent name comes from the driver; the partition suffix comes from a naming rule that exists solely to disambiguate NVMe. <b>/dev/mapper/*</b> is not a kernel device at all in the enumeration sense — it is a symlink the device-mapper target creates.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Comparison of device name anatomy for SATA, NVMe and virtio block devices">
  <text class="t-title" x="40" y="34">WHO GENERATES THE NAME — and where the partition suffix comes from</text>

  <rect class="box" x="40" y="56" width="1020" height="112" rx="10"/>
  <text class="t-accent" x="60" y="84" font-size="16">SATA / SCSI - ends in a letter, no separator</text>
  <text class="t-title" x="60" y="118">/dev/sda</text>
  <text class="t-title" x="330" y="118">/dev/sda1</text>
  <text class="t-title" x="640" y="118">/dev/sda15</text>
  <text class="t-sm t-dim" x="60" y="146">sda = SCSI host 0, bus 0, target 0, lun 0 - all four packed into letters, and silently reused when they wrap.</text>
  <text class="t-xs t-dim" x="60" y="162">Ordering is a race between probe completion. Two identical disks can swap sda/sdb between reboots.</text>

  <rect class="box" x="40" y="182" width="1020" height="112" rx="10"/>
  <text class="t-violet" x="60" y="210" font-size="16">NVMe - parent already ends in a digit, so a 'p' separator is inserted</text>
  <text class="t-title" x="60" y="244">/dev/nvme0n1</text>
  <text class="t-title" x="360" y="244">/dev/nvme0n1p1</text>
  <text class="t-title" x="700" y="244">/dev/nvme0n1p15</text>
  <text class="t-sm t-dim" x="60" y="272">Without the 'p', n1 + 15 reads as nvme0n115 - a legal-looking device name that is not yours.</text>
  <text class="t-xs t-bad" x="60" y="288">Wrong spelling is not caught. It is just No such file or directory, at mount time, possibly during boot.</text>

  <rect class="box" x="40" y="308" width="1020" height="112" rx="10"/>
  <text class="t-ok" x="60" y="336" font-size="16">virtio-blk - what a VPS gives you; virtio-scsi adds a 'v' + controller in the partition name</text>
  <text class="t-title" x="60" y="370">/dev/vda</text>
  <text class="t-title" x="330" y="370">/dev/vda1</text>
  <text class="t-sm" x="620" y="370">/dev/vdb (extra data disk)</text>
  <text class="t-sm t-dim" x="60" y="398">The guest sees a virtual disk. Sector count, IOPS cap and latency are the provider's policy, not the disk's.</text>
  <text class="t-xs t-dim" x="60" y="414">Sizing one of these up online is possible: the volume grows underneath and you extend partition + filesystem.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Ask each layer the one question it can answer. Run all four; they cross-check each other, and a disagreement between them is the diagnosis.",
        code: `$ lsblk -f
NAME   FSTYPE LABEL  UUID        MOUNTPOINT
vda
└─vda1 ext4   root   9f2c1d84-  /

# -f adds filesystem, label and UUID. Without it you only get sizes and mountpoints.
# The same fact as columns, plus which device the kernel actually has:

$ sudo blkid
/dev/vda1: UUID="9f2c1d84-2b1e-4f0a-9c33-6d5a1e77b210" TYPE="ext4" PARTLABEL="root"

$ findmnt /
TARGET SOURCE        FSTYPE OPTIONS
/     /dev/vda1     ext4   rw,relatime,errors=remount-ro

$ df -hT /
Filesystem     Type  Size  Used Avail Use% Mounted on
/dev/vda1      ext4   19G  4.6G   14G  25% /`
      },
      {
        type: "kv",
        items: [
          { k: "lsblk -f", v: "Layer 1 and 2. Shows the device tree, the child partitions and their filesystems. The fastest answer to 'what does the kernel think it has'." },
          { k: "blkid", v: "Layer 3 only. Reads the superblock directly off the raw device, so it works on unmounted disks and rescue media. Probes by magic number, not by extension." },
          { k: "findmnt /path", v: "Layer 4. The VFS view: what is mounted at this path, from which device, with which options. Does not need the device to exist." },
          { k: "df -hT", v: "Space, by filesystem. Reports inodes too with <code>-i</code>. Silently hides bind mounts and other filesystems only if you pass them the right arguments — <code>df -x tmpfs -x devtmpfs</code> is the honest version." },
          { k: "mount", v: "Dumps the mount table. On systemd boxes this is generated, not authored — <code>/etc/fstab</code> plus runtime mounts from <code>.mount</code> units." },
          { k: "/sys/block/*/size", v: "Kernel's sector count for a device, in 512-byte sectors, live. Changes when a cloud volume is resized underneath you." }
        ]
      },
      {
        type: "prose",
        h: "GPT, the protective MBR, and why a UEFI disk needs a table at all",
        p: [
          "An MBR partition table lives in the 512 bytes at LBA 0: a 446-byte boot code area, four 16-byte primary entries, and two bytes of signature (<code>0x55AA</code>) that BIOS firmware reads as 'this disk is bootable'. The MBR's hard limits are famous: four primary partitions, no partitions above 2 TiB, no partition table checksum, and the table is stored only at the front — so if sector 0 is lost, the partition map is gone even though the data is intact.",
          "GPT stores the table as an EFI Cylinder-Head-Sector structure: an <code>EFI PART</code> header at LBA 1, an array of 128 partition entries at LBA 2 through 33, and — this is the important part — an identical <strong>backup copy at the end of the disk</strong> (entries in the last 33 sectors, header in the final sector). 128 entries, 128-bit disk and partition GUIDs, a 1 MiB alignment default that SSD pages require, and a CRC32 over the structure. Backup GPT exists for the same reason the journal exists: the partition table is the one structure you cannot rebuild from anything else.",
          "GPT on a BIOS or MBR system still writes an MBR in LBA 0, and it is worth being precise about what it is. It is a <strong>protective MBR</strong>: a single entry of type <code>0xEE</code> spanning the whole disk, which says 'the real table is GPT, read LBA 1'. It is not a usable partition and it is not a fallback. Old tools that predate GPT read that type as '0xEE = unknown', print nothing useful, and refuse to write anything without a warning. That is a feature: it prevents a 2004-era <code>fdisk</code> from cheerfully creating an MBR table that hides every GPT partition.",
          "Why does a UEFI machine <em>require</em> GPT rather than a bare MBR? Because UEFI firmware does not execute MBR boot code. It reads the <code>EFI System Partition</code> — a FAT32 partition carrying <code>\\EFI\\</code> with the <code>*.efi</code> binaries — using the type GUID <code>C12A7328-F81F-11D2-BA4B-00A0C93EC93B</code>. There is no MBR-shaped entry point, so no MBR-only disk. A dual-boot disk additionally needs the BIOS boot partition (<code>21686148-6449-6E6F-744E-656564454649</code>) because the legacy BIOS boot path still needs somewhere to stage its first-stage loader.",
          "Practical consequence on a cloud VPS: the firmware is irrelevant, the GPT is not. Cloud images ship with a protective MBR plus GPT plus a single partition, because the <code>virtio-blk</code> disk is attached as a normal block device and the image must boot regardless of which host lays it out."
        ]
      },
      {
        type: "diagram",
        h: "GPT disk layout and the two failure-recovery paths",
        caption: "The diagram reads left to right as sectors on the disk. <b>Backup GPT at the tail</b> is the part people forget: it is what lets <code>gdisk</code> and <code>sgdisk</code> say <i>backup GPT table is corrupt, but main is OK</i> instead of losing the partition map.",
        svg: `
<svg viewBox="0 0 1100 480" role="img" aria-label="GPT disk layout showing protective MBR, primary header, entries, data area and backup GPT">
  <text class="t-title" x="40" y="34">A 19 GiB GPT DISK, SECTOR BY SECTOR</text>
  <text class="t-xs t-dim" x="40" y="54">logical sectors of 512 bytes - the unit virtio-blk actually speaks</text>

  <rect class="box-w" x="40" y="72" width="88" height="86" rx="8"/>
  <text class="t-warn" x="84" y="100" text-anchor="middle" font-size="14">LBA 0</text>
  <text class="t-xs" x="84" y="120" text-anchor="middle">protective</text>
  <text class="t-xs" x="84" y="138" text-anchor="middle">MBR</text>
  <text class="t-xs t-dim" x="84" y="176" text-anchor="middle">type 0xEE</text>

  <rect class="box-a" x="134" y="72" width="72" height="86" rx="8"/>
  <text class="t-accent" x="170" y="100" text-anchor="middle" font-size="14">LBA 1</text>
  <text class="t-xs" x="170" y="122" text-anchor="middle">primary</text>
  <text class="t-xs" x="170" y="140" text-anchor="middle">header</text>

  <rect class="box-v" x="212" y="72" width="120" height="86" rx="8"/>
  <text class="t-violet" x="272" y="100" text-anchor="middle" font-size="14">LBA 2-33</text>
  <text class="t-xs" x="272" y="122" text-anchor="middle">128 entries,</text>
  <text class="t-xs" x="272" y="140" text-anchor="middle">128 bytes each</text>

  <rect class="box-ok" x="338" y="72" width="330" height="86" rx="8"/>
  <text class="t-ok" x="503" y="100" text-anchor="middle" font-size="15">partition data area - aligned to 1 MiB</text>
  <text class="t-xs" x="503" y="124" text-anchor="middle">vda1 starts at LBA 2048 (byte 1048576), not LBA 63</text>
  <text class="t-xs" x="503" y="144" text-anchor="middle">that offset is what makes an SSD erase block align with the filesystem</text>

  <rect class="box-v" x="674" y="72" width="120" height="86" rx="8"/>
  <text class="t-violet" x="734" y="100" text-anchor="middle" font-size="14">last 33</text>
  <text class="t-xs" x="734" y="122" text-anchor="middle">sectors</text>
  <text class="t-xs" x="734" y="140" text-anchor="middle">backup entries</text>

  <rect class="box-a" x="800" y="72" width="72" height="86" rx="8"/>
  <text class="t-accent" x="836" y="100" text-anchor="middle" font-size="14">last</text>
  <text class="t-xs" x="836" y="124" text-anchor="middle">backup</text>
  <text class="t-xs" x="836" y="142" text-anchor="middle">header</text>

  <rect class="box-p" x="878" y="72" width="120" height="86" rx="8"/>
  <text class="t-bad" x="938" y="100" text-anchor="middle" font-size="14">LBA -1</text>
  <text class="t-xs" x="938" y="122" text-anchor="middle">unguarded</text>
  <text class="t-xs" x="938" y="140" text-anchor="middle">tail</text>

  <path class="ln" d="M128,115 L132,115" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M206,115 L210,115" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M332,115 L336,115" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M668,115 L672,115" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M794,115 L798,115" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M872,115 L876,115" marker-end="url(#lm-arrow)"/>

  <line class="ln-w dash" x1="40" y1="206" x2="1060" y2="206" stroke-width="2"/>
  <text class="t-warn" x="40" y="230" font-size="15">two independent ways to lose your partition map, and what happens in each</text>

  <rect class="box-b" x="40" y="250" width="500" height="120" rx="10"/>
  <text class="t-bad" x="60" y="276" font-size="15">front table destroyed</text>
  <text class="t-sm" x="60" y="300">sgdisk -e / e2fsprogs rebuilds it from the backup copy.</text>
  <text class="t-sm" x="60" y="322">Your data never moved; only the description of it was lost.</text>
  <text class="t-xs t-dim" x="60" y="348">sgdisk -e /dev/vda  -&gt;  The partition table entries are not in sync with disk</text>

  <rect class="box-b" x="566" y="250" width="494" height="120" rx="10"/>
  <text class="t-bad" x="586" y="276" font-size="15">tail table destroyed</text>
  <text class="t-sm" x="586" y="300">Equally unrecoverable - and far more common, because solid-state</text>
  <text class="t-sm" x="586" y="322">firmware reallocates blocks near the end of the device under wear levelling.</text>
  <text class="t-xs t-dim" x="586" y="348">Never let a cheap consumer SSD run a partition table at 100% full. Leave a few GB headroom.</text>

  <text class="t-accent" x="40" y="404" font-size="15">read a partition table without touching data, from any rescue system:</text>
  <text class="t-sm" x="40" y="428">$ sudo gdisk -l /dev/vda      # GPT-aware, shows both copies</text>
  <text class="t-sm" x="40" y="450">$ sudo parted -s /dev/vda unit s print free    # exact sectors, shows unallocated tail</text>
</svg>`
      },
      {
        type: "prose",
        h: "LVM: a tool with a real use case and a real cost",
        p: [
          "LVM inserts three new layers between a partition and a filesystem. A block device is marked as a <strong>Physical Volume</strong> (PV). One or more PVs are pooled into a <strong>Volume Group</strong> (VG), which carves the space into fixed-size <strong>extents</strong> (4&nbsp;MiB by default) and hands them out to <strong>Logical Volumes</strong> (LVs). An LV is what you format and mount. The LV is a <code>/dev/mapper/vg0-name</code> device built by the device-mapper target layer, so the filesystem never learns that it is not talking to a real disk.",
          "That indirection buys four things, and it is worth being honest that two of them are real and two are usually not. <strong>Thin provisioning</strong> is genuinely useful: an LV with a 500&nbsp;GB virtual size can sit on 20&nbsp;GB of actual PV and grow into the pool as it fills, with a <code>Data</code> percentage you monitor. <strong>Snapshots</strong> are cheap and instant (<code>lvcreate -s</code> is a metadata operation, effectively) and are the right way to take a pre-upgrade snapshot. <strong>Online resize</strong> means <code>lvresize</code> and <code>resize2fs</code> while mounted. The fourth — <em>moving data between disks</em> — is real for physical machines and irrelevant for a cloud VPS where the volume is already managed from outside.",
          "The costs are real too. Every read and write now traverses device-mapper, which costs a measurable percentage on small sequential I/O. Metadata lives in <code>/etc/lvm/</code>, and a corrupt metadata area means every LV is gone until you restore <code>/etc/lvm/backup/</code> — so a LVM box needs its metadata in your backups, always. On a 19&nbsp;GB volume holding nginx config and static sites, LVM buys you nothing: you cannot snapshot your way out of a bad <code>rm</code>, you cannot thin-provision your way past a provider disk-size limit, and you now have a metadata layer to lose.",
          "My honest advice for the reference class of machine: <strong>no LVM unless you have a concrete reason</strong> — separate <code>/var</code> you must not share with root, thin pools for many small containers, or snapshot-before-upgrade discipline on a box you cannot afford to reinstall. If you do adopt it, keep <code>/etc/lvm/backup</code> off the box and write it down."
        ]
      },
      {
        type: "diagram",
        h: "The LVM stack, top to bottom",
        caption: "Note that an LV is not a partition and not a device — it is a mapping table plus a set of extents. That is why <code>vgs</code>, <code>lvs</code> and <code>pvs</code> are the three commands you actually need, and why <code>lvdisplay</code> with a full path is often the fastest way to answer 'where did these bytes physically land'.",
        svg: `
<svg viewBox="0 0 1100 580" role="img" aria-label="LVM stack from filesystem down through logical volume, volume group, physical volume to block devices">
  <text class="t-title" x="40" y="34">PV / VG / LV — three names for the same bytes at different altitudes</text>

  <rect class="box-ok" x="40" y="56" width="440" height="72" rx="10"/>
  <text class="t-ok" x="60" y="84" font-size="15">ext4 on /dev/mapper/vg0-root</text>
  <text class="t-xs" x="60" y="108">the filesystem thinks it owns a disk. It is wrong, and that is the point.</text>

  <rect class="box-a" x="40" y="148" width="440" height="88" rx="10"/>
  <text class="t-accent" x="60" y="176" font-size="15">LOGICAL VOLUME  root   30G  (LV)</text>
  <text class="t-xs" x="60" y="200">a linear map of extents -&gt; physical areas. Also: var, swap, lv_home.</text>
  <text class="t-xs" x="60" y="220">lvs, lvdisplay -m  ·  thin LV lives under a pool here</text>

  <rect class="box-v" x="40" y="256" width="440" height="88" rx="10"/>
  <text class="t-violet" x="60" y="284" font-size="15">VOLUME GROUP  vg0   59.99G  (VG)</text>
  <text class="t-xs" x="60" y="308">owns the extents. 4 MiB default extent size is baked in at pvcreate time</text>
  <text class="t-xs" x="60" y="328">and cannot be changed without rebuilding the whole VG. vgs, vgdisplay</text>

  <rect class="box-w" x="40" y="364" width="440" height="88" rx="10"/>
  <text class="t-warn" x="60" y="392" font-size="15">PHYSICAL VOLUME  /dev/vda3  (PV)</text>
  <text class="t-xs" x="60" y="416">just a block device with an LVM2 label at LBA 1. blkid says TYPE=LVM2_member.</text>
  <text class="t-xs" x="60" y="436">pvs, pvdisplay  ·  pvcreate /dev/vda3</text>

  <rect class="box" x="40" y="472" width="440" height="72" rx="10"/>
  <text class="t-sm" x="60" y="500">/dev/vda   virtio-blk, 19 GiB</text>
  <text class="t-xs" x="60" y="524">pvs, lsblk. On the reference box this layer does not exist.</text>

  <path class="ln-a" d="M260,128 L260,146" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M260,236 L260,254" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M260,344 L260,362" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M260,452 L260,470" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box" x="540" y="56" width="520" height="180" rx="10"/>
  <text class="t-title" x="560" y="84">THE METADATA YOU ARE NOW RESPONSIBLE FOR</text>
  <text class="t-sm" x="560" y="112">/etc/lvm/backup/&lt;vg&gt;/&lt;vg&gt;_&lt;date&gt;.vg   - text dumps of the whole mapping</text>
  <text class="t-sm" x="560" y="136">/etc/lvm/archive/  - rotating set, default keep 7 archives</text>
  <text class="t-sm" x="560" y="160">/etc/lvm/cache/    - cached devices and status</text>
  <text class="t-xs t-dim" x="560" y="186">mvbackup=&lt;vg&gt;_ext_&lt;date&gt; and vgcfgbackup are how you restore a mapping table without</text>
  <text class="t-xs t-dim" x="560" y="204">the original PVs. Copy /etc/lvm off-box in the same rsync that ships /var/www/html.</text>
  <text class="t-xs t-bad" x="560" y="226">Lose /etc/lvm with no backup: every LV disappears, and fsck cannot help.</text>

  <rect class="box" x="540" y="256" width="520" height="150" rx="10"/>
  <text class="t-title" x="560" y="284">THE FOUR COMMANDS THAT ANSWER EVERYTHING</text>
  <text class="t-sm" x="560" y="312">pvs   -o pv_name,vg_name,pv_size,pv_free    - which PV, which VG, how full</text>
  <text class="t-sm" x="560" y="336">vgs   -o vg_name,vg_size,vg_free            - is there room for another LV</text>
  <text class="t-sm" x="560" y="360">lvs   -o lv_name,lv_size,data_percent       - thin pool fill, if data_percent is printed</text>
  <text class="t-sm" x="560" y="384">lvdisplay -m vg0                            - LV to physical extent map, the useful one</text>

  <rect class="box-w" x="540" y="426" width="520" height="118" rx="10"/>
  <text class="t-warn" x="560" y="452" font-size="15">device-mapper locking is not free</text>
  <text class="t-sm" x="560" y="478">Every lvm command takes a write lock on /run/lock/lvm with a flock.</text>
  <text class="t-sm" x="560" y="502">In a container with a private /run, two LVM-touching processes can deadlock</text>
  <text class="t-sm" x="560" y="526">until you reboot. Not a problem on a plain VPS; a real problem in LXD/K8s nodes.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "A complete LVM lifecycle: create, populate, verify, resize online, snapshot, remove. Every command here runs while mounted.",
        code: `# create the PV on a partition (never on the whole disk if you want to keep a partition table)
$ sudo pvcreate /dev/vda3
  Physical volume "/dev/vda3" successfully created.

$ sudo vgcreate vg0 /dev/vda3
  Volume group "vg0" successfully created
  Created logical volume vg0/lv_swap using extents.

$ sudo lvcreate -L 2G -n lv_swap vg0
$ sudo lvcreate -L 8G -n lv_root vg0
$ sudo lvcreate -L 30G -n lv_var  vg0
$ sudo mkswap /dev/vg0/lv_swap && sudo swapon /dev/vg0/lv_swap
$ sudo mkfs.ext4 /dev/vg0/lv_root
$ sudo mount /dev/vg0/lv_root /mnt/newroot

# inspect
$ sudo pvs -o pv_name,vg_name,pv_size,pv_free
$ sudo lvs -o lv_name,lv_size,devices
$ sudo lvdisplay -m vg0

# snapshot: metadata-only, instant, COW against the origin
$ sudo lvcreate -s -L 1G -n root_snap vg0/lv_root
$ sudo mount -o ro /dev/vg0/root_snap /mnt/snap
$ rsync -aHAX /mnt/snap/ backup:/backup/vg0-snap/
$ sudo lvremove vg0/root_snap

# grow the LV and the filesystem while everything is mounted
$ sudo lvresize -l +100%FREE /dev/vg0/lv_var
  Size of logical volume vg0/lv_var changed from <8.00 GiB> to <28.00 GiB>.
  Filesystem at /dev/mapper/vg0-lv_var is mounted on /var; on-line resizing required
$ sudo resize2fs /dev/vg0/lv_var
  The filesystem on /dev/mg0/lv_var is now 29360128 (4k) blocks long.

# teardown, in strict reverse order
$ sudo umount /mnt/snap
$ sudo lvremove -f vg0/lv_swap /dev/vg0/lv_var /dev/vg0/lv_root
$ sudo vgremove vg0
$ sudo pvremove /dev/vda3`
      },
      {
        type: "prose",
        h: "RAID is availability, not backup — and the difference is the whole point",
        p: [
          "RAID arranges several block devices so that one or more of them can fail without the filesystem noticing. That is the entire promise, and the promise is narrower than it sounds. A RAID array protects you against a disk dying. It does nothing at all about <code>rm -rf /var/www</code>, a bad <code>rsync</code> that overwrites live files with an old version, a compromised SSH key, ransomware that can write to the mounted array, the building catching fire, or an <code>fsck</code> bug deciding your filesystem is empty. All of those write correct data to all members simultaneously, because that is what the array is asked to do.",
          "This is worth stating bluntly because RAID gets bought under exactly the wrong expectation. A RAID 6 array will faithfully replicate a corrupted delete across all four disks in about eight seconds. If your backup strategy is 'it's on RAID', you have no backup strategy — you have an uptime strategy with a write amplifier attached.",
          "Two further realities. First, an array is not a backup target: you cannot copy onto a mounted RAID the way you can onto a filesystem, so backups come off it via a snapshot or by mounting an idle member. Second, a degraded array is not a healthy one. RAID 5 tolerates one failure and then every read and write pays a read-modify-write penalty until you replace the disk; RAID 6 tolerates two. And a controller cache with battery-backed write-through is part of the correctness argument on real hardware — consumer cards frequently lie about flushes, which is how a clean shutdown ends with a corrupt array."
        ]
      },
      {
        type: "diagram",
        h: "Parity layouts: what each level actually costs",
        caption: "<b>RAID 5 and 6 spread parity across the array</b> — small stripes, one bad disk degrades every stripe. <b>RAID 10 mirrors whole stripes</b> — large write unit, but the read path is simple and rebuilds are per-mirror. Watch the write cost row: RAID 6 is 4 I/Os per small write, RAID 10 is 2.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="RAID 0, RAID 1, RAID 5, RAID 6 and RAID 10 layouts with capacity and write cost">
  <text class="t-title" x="40" y="34">THE SAME FOUR DISKS, ARRANGED FIVE WAYS</text>

  <text class="t-sm" x="40" y="66">RAID 0 - stripe</text>
  <rect class="box-a" x="180" y="44" width="88" height="34" rx="6"/><text class="t-xs" x="224" y="65" text-anchor="middle">A1</text>
  <rect class="box-a" x="272" y="44" width="88" height="34" rx="6"/><text class="t-xs" x="316" y="65" text-anchor="middle">B1</text>
  <rect class="box-a" x="364" y="44" width="88" height="34" rx="6"/><text class="t-xs" x="408" y="65" text-anchor="middle">C1</text>
  <rect class="box-a" x="456" y="44" width="88" height="34" rx="6"/><text class="t-xs" x="500" y="65" text-anchor="middle">D1</text>
  <text class="t-sm" x="570" y="65">100% of all disks usable</text>
  <text class="t-bad" x="770" y="65">one disk = whole array</text>

  <text class="t-sm" x="40" y="120">RAID 1 - mirror</text>
  <rect class="box-ok" x="180" y="98" width="130" height="34" rx="6"/><text class="t-xs" x="245" y="119" text-anchor="middle">A1 A2 B1 B2</text>
  <rect class="box-ok" x="314" y="98" width="130" height="34" rx="6"/><text class="t-xs" x="379" y="119" text-anchor="middle">A1 A2 B1 B2</text>
  <text class="t-sm" x="570" y="119">50% usable</text>
  <text class="t-ok" x="770" y="119">1 disk lost - no penalty</text>

  <text class="t-sm" x="40" y="174">RAID 5 - rotating P</text>
  <rect class="box-a" x="180" y="152" width="88" height="34" rx="6"/><text class="t-xs" x="224" y="173" text-anchor="middle">A1</text>
  <rect class="box-a" x="272" y="152" width="88" height="34" rx="6"/><text class="t-xs" x="316" y="173" text-anchor="middle">B1</text>
  <rect class="box-a" x="364" y="152" width="88" height="34" rx="6"/><text class="t-xs" x="408" y="173" text-anchor="middle">C1</text>
  <rect class="box-w" x="456" y="152" width="88" height="34" rx="6"/><text class="t-warn" x="500" y="173" text-anchor="middle">1*A</text>
  <text class="t-sm" x="570" y="173">75% usable</text>
  <text class="t-warn" x="770" y="173">degraded = RMW writes</text>

  <text class="t-sm" x="40" y="228">RAID 5 - rotated P</text>
  <rect class="box-w" x="180" y="206" width="88" height="34" rx="6"/><text class="t-warn" x="224" y="227" text-anchor="middle">1*A</text>
  <rect class="box-a" x="272" y="206" width="88" height="34" rx="6"/><text class="t-xs" x="316" y="227" text-anchor="middle">B1</text>
  <rect class="box-a" x="364" y="206" width="88" height="34" rx="6"/><text class="t-xs" x="408" y="227" text-anchor="middle">C1</text>
  <rect class="box-a" x="456" y="206" width="88" height="34" rx="6"/><text class="t-xs" x="500" y="227" text-anchor="middle">D1</text>
  <text class="t-xs t-dim" x="180" y="256">parity for this stripe lives on disk 1, so a rebuild reads every other disk</text>
  <text class="t-xs t-dim" x="180" y="272">and 1.5 TB of reads per TB restored. A 4 TB 5-array rebuilding is an overnight job.</text>

  <text class="t-sm" x="40" y="322">RAID 6 - P + Q</text>
  <rect class="box-a" x="180" y="300" width="88" height="34" rx="6"/><text class="t-xs" x="224" y="321" text-anchor="middle">A1</text>
  <rect class="box-a" x="272" y="300" width="88" height="34" rx="6"/><text class="t-xs" x="316" y="321" text-anchor="middle">B1</text>
  <rect class="box-v" x="364" y="300" width="88" height="34" rx="6"/><text class="t-xs" x="408" y="321" text-anchor="middle">C1</text>
  <rect class="box-v" x="456" y="300" width="88" height="34" rx="6"/><text class="t-xs" x="500" y="321" text-anchor="middle">D1</text>
  <text class="t-sm" x="570" y="321">50% usable</text>
  <text class="t-ok" x="770" y="321">2 disks lost, still up</text>

  <text class="t-sm" x="40" y="376">RAID 10 - mirror of stripe</text>
  <rect class="box-ok" x="180" y="354" width="170" height="34" rx="6"/><text class="t-xs" x="265" y="375" text-anchor="middle">A1 A2 B1 B2</text>
  <rect class="box-ok" x="354" y="354" width="170" height="34" rx="6"/><text class="t-xs" x="439" y="375" text-anchor="middle">A1 A2 B1 B2</text>
  <text class="t-sm" x="570" y="375">50% usable</text>
  <text class="t-ok" x="770" y="375">1 lost per mirror</text>
  <text class="t-xs t-dim" x="180" y="404">Sequential writes are full-stripe, so no parity penalty - this is why databases pick 10.</text>

  <line class="ln-w dash" x1="40" y1="424" x2="1060" y2="424" stroke-width="2"/>
  <text class="t-bad" x="40" y="448" font-size="15">NONE of these protects you from any of the following:</text>
  <text class="t-sm" x="60" y="474">rm -rf  ·  a bad rsync overwriting live files  ·  ransomware or a compromised SSH key  ·  an fsck bug</text>
  <text class="t-sm" x="60" y="496">fire, flood, theft  ·  the provider deleting the volume  ·  a mistake you make while the array is healthy</text>
  <text class="t-xs t-dim" x="60" y="522">An array is a fault-tolerance mechanism. A backup is a copy, somewhere else, that you have restored from at least once.</text>
</svg>`
      },
      {
        type: "table",
        cols: ["Level", "Min disks", "Usable capacity", "Survives", "Write cost, small write", "Honest verdict"],
        rows: [
          ["<code>RAID 0</code>", "2", "100%", "nothing", "1", "Speed only. Every consumer 'RAID 0' box is this. One disk failure loses everything, including the redundancy you thought you bought."],
          ["<code>RAID 1</code>", "2", "50%", "1 disk", "2", "Simple, fast rebuild, fast reads. Scales in twos only. On a VPS this is what the provider's 'redundant volume' is."],
          ["<code>RAID 5</code>", "3", "N-1 disks", "1 disk", "4 (RMW)", "The old default. A rebuild stresses every other disk for hours, and URE during that rebuild kills the array. Fine for archival; wrong for anything you care about."],
          ["<code>RAID 6</code>", "4", "N-2 disks", "2 disks", "6 (RMW)", "The sane minimum for large arrays now. Double parity, Xeon checksum avoids the RAID 5 stripe-mirroring corruption hole. Costs you half the raw capacity."],
          ["<code>RAID 10</code>", "4", "50%", "1 per mirror", "2", "Best write behaviour and predictable rebuilds. Database default. Fails as soon as both disks of a mirror are gone, even with other mirrors healthy."],
          ["<code>ZFS RAIDZ2/3</code>", "3 / 5", "N-2 / N-3", "2 / 3 disks, plus scrub-corrects silent bit rot", "varies", "Self-healing checksums beat parity arithmetic: ZFS detects a read error and reconstructs from parity without you noticing. The read cost is paid on scrub, not on every read."]
        ]
      },
      {
        type: "prose",
        h: "Filesystems compared by what they are actually good at",
        p: [
          "<strong>ext4</strong> is the Ubuntu default for good reasons: a journal, 128-bit inodes, extent mapping, and eleven years of every worst case already discovered by somebody else. Two behaviours surprise people. First, <strong>df is conservative by design</strong>: by default ext4 reserves 5% of blocks for root, and on a 19&nbsp;GB volume that is roughly 950&nbsp;MB that <code>df</code> reports as used no matter how empty the disk is. On a small root you can see it and change it with <code>tune2fs -m 1 /dev/vda1</code> — but only on a root filesystem you can reach through another boot path, because unmounting root to change it means finding the console. Second, ext4 grows online and shrinks <em>only unmounted</em> (and even then only with <code>e2fsck -f</code> first).",
          "<strong>xfs</strong> is better at large files, large filesystems and parallel write throughput, which is why it is the RHEL/Fedora default and the choice for big media and multi-writer workloads. Its asymmetry is the fact to memorise: <strong>xfs_growfs grows a mounted filesystem, and it can never shrink one, ever, not even unmounted</strong>. The kernel module for shrinking was removed in Linux 4.x-era kernels and never came back. Design XFS volumes so that shrinking is not a thing you will need. You also cannot repair XFS online — <code>xfs_repair</code> requires the filesystem unmounted.",
          "<strong>btrfs</strong> is the copy-on-write filesystem and the reason snapshots became cheap on ordinary Linux. Every write goes to new blocks and only then is the tree metadata atomically relinked, which gives three things at once: instantaneous snapshots, checksums on metadata <em>and</em> data (so bit rot is detected instead of silently returned), and multi-device support with its own RAID profiles. Add subvolumes (independent, snapshot-able, quota-able trees that share one filesystem — effectively free tenants), <code>zlib</code>/<code>lzo</code>/<code>zstd</code> compression per subvolume, and <code>btrfs balance</code> for reallocating chunks. The honest caveats: it needed <code>btrfs-progs</code> on Ubuntu before 18.04 and is not in the 18.04 installer default set, space accounting through <code>df</code> is misleading because <code>btrfs</code> reports the whole device for each subvolume (read <code>btrfs filesystem usage /</code> instead), balance operations are heavy, and there is a long tail of reported issues around very large devices and snapshots of snapshots. On a 19&nbsp;GB VPS the feature set is far beyond what you need and the risk is not.",
          "<strong>ZFS</strong> is the other CoW option, with a design origin in Solaris and a genuinely different performance model: the <strong>ARC</strong> is an adaptive read cache in RAM that manages its own memory pressure by keeping a <code>default</code>-sized LRU list for things it has not seen twice, and its pool sits on a vdev tree you assemble yourself. <code>zfs create</code> gives you datasets with per-dataset compression, quotas, reservations and independent snapshots; <code>zfs send</code>/<code>recv</code> gives you incremental replication off-box. On Ubuntu the honest caveat is packaging: ZFS is not in the kernel, it ships as the <code>zfsutils-linux</code> PPA (Ubuntu Pro's <code>zfs-linux</code> on newer releases), which is an out-of-tree DKMS module. An unattended-upgrades kernel bump triggers a DKMS rebuild, and if the rebuild fails on a remote box you have no way to boot into the new kernel. That is a real operational cost and it is why I would not put ZFS on a 2&nbsp;GB box reached only over SSH.",
          "<strong>tmpfs</strong> is not a disk at all — it is a page cache pinned in RAM and presented as a filesystem, which is why its size shows up in <code>free</code> output under no heading that makes sense the first time you see it. It costs no read I/O, which makes it right for <code>/run</code>, <code>/dev/shm</code> and build scratch, and wrong for anything you want to survive a reboot."
        ]
      },
      {
        type: "cards",
        items: [
          { title: "ext4", tag: "DEFAULT", tone: "ok", text: "Ubuntu's default and correct choice on a small VPS. Journaled, extent-mapped, shrinks unmounted only. Reserve is 5% by default — <code>tune2fs -m 1</code> if you need the space." },
          { title: "xfs", tag: "LARGE FILES", tone: "violet", text: "Excellent parallel throughput, large-file handling, but <strong>grows only</strong>: no shrink exists in Linux. <code>xfs_growfs /mount</code> online; repair needs unmounted." },
          { title: "btrfs", tag: "SNAPSHOTS", tone: "accent", text: "CoW, data + metadata checksums, subvolumes, built-in RAID, compression. Needs <code>btrfs-progs</code> on 18.04; <code>df</code> lies about space — use <code>btrfs filesystem usage</code>." },
          { title: "zfs", tag: "INTEGRITY", tone: "pink", text: "ARC cache, datasets, snapshots, vdev RAID, self-healing scrubs, <code>zfs send</code> replication. Ubuntu = PPA + DKMS module, and a failed DKMS build means no remote boot." },
          { title: "tmpfs", tag: "RAM", tone: "warn", text: "RAM wearing a filesystem costume. Zero disk I/O, zero survival across reboot, and <strong>it counts against your memory limit</strong> — which breaks containers in a way that looks nothing like an OOM kill." }
        ]
      },
      {
        type: "prose",
        h: "tmpfs, and the container memory bug it causes",
        p: [
          "Mounting <code>tmpfs /dev/shm tmpfs  defaults,size=64M 0 0</code> is the standard Docker workaround, and the reason it exists is a genuine surprise rather than a hypothetical. A Docker container gets <code>--shm-size</code> of 64&nbsp;MB by default, but POSIX shared memory inside the container is mounted as its own filesystem, and glibc, Python multiprocessing, PostgreSQL parallel query and anything using <code>sem_open</code> create <code>segment</code> files there. Fill it and you get <code>Bus error</code> (SIGBUS, signal 7) — not <code>No space left on device</code>, not an OOM kill. A <code>Bus error</code> in a JVM, a Python worker or a <code>torch</code> dataloader on a machine with 15&nbsp;GB free is one of the more confusing failures in the container world, and the cause is a 64&nbsp;MB tmpfs.",
          "The second effect is subtler and hits you on this class of machine. tmpfs pages are real pages: they are not swappable and they are charged to the same accounting as anonymous memory. A container with a 512&nbsp;MB limit that writes 300&nbsp;MB into <code>/dev/shm</code> has 300&nbsp;MB less for its heap, and cgroups will kill it — even though a host <code>free -h</code> shows plenty available. Under cgroups v1 the memory is charged to <code>/sys/fs/cgroup/memory/docker/&lt;id&gt;/memory.usage_in_bytes</code>; under v2 it lands in <code>memory.current</code> inside the container's cgroup. Either way the diagnosis is the same: your tmpfs is inside the limit.",
          "On the reference box, <code>docker info</code> reports <code>Storage Driver: overlay2</code> and container writable layers land on <code>/var/lib/docker</code> on root. A chatty service that writes to <code>/tmp</code> inside a container with no <code>--tmpfs /tmp:size=…</code> is writing to the overlay layer, on the 19&nbsp;GB root, forever, invisible to <code>docker ps</code>. Add <code>--tmpfs /tmp:rw,noexec,nosuid,size=64m</code> and the problem becomes a tmpfs you can see in <code>docker system df</code>."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Prove what a tmpfs costs, size it explicitly, and see the accounting land in the same place a container's memory limit does.",
        code: `# a tmpfs mount shows up in df with size 0 - it is not a disk, so it has no capacity to report
$ df -hT -t tmpfs
Filesystem     Type  Size  Used Avail Use% Mounted on
tmpfs          tmpfs     0     0     0   0% /dev/shm
tmpfs          tmpfs     0     0     0   0% /run

# write 200 MB and watch both free and mountinfo change
$ dd if=/dev/zero of=/dev/shm/blob bs=1M count=200
$ df -h /dev/shm
Filesystem      Type  Size  Used Avail Use% Mounted on
tmpfs           tmpfs  1.6G  200M  1.4G  13% /dev/shm
$ free -h | head -2
               total        used        free
Mem:           1.9Gi       980Mi       520Mi
$ mount | grep shm
tmpfs on /dev/shm type tmpfs (rw,nosuid,nodev,noexec,relatime,size=402653184k)

# the same accounting inside a container limit (cgroups v1 layout on 18.04)
$ docker run --rm --memory=256m ubuntu:18.04 bash -c \\
    'dd if=/dev/zero of=/dev/shm/x bs=1M count=300; echo survived'
dd: error writing '/dev/shm/x': No space left on device
survived
# 64M /dev/shm by default: bump it, and take --memory down with it
$ docker run --rm --memory=256m --shm-size=128m ubuntu:18.04 \\
    bash -c 'dd if=/dev/zero of=/dev/shm/x bs=1M count=100; echo survived'
100+0 records in
100+0 records out
survived`
      },
      {
        type: "prose",
        h: "Mount options that quietly change behaviour",
        p: [
          "<code>relatime</code> updates an inode's access time when it is more than 24 hours old or older than its mtime. <code>strictatime</code> updates it on every read. <code>noatime</code> never updates it. The default since 2.6.30 is <code>relatime</code>, and on <code>findmnt /</code> on the reference box you can see it. <code>noatime</code> is a small real win on a device whose IOPS you are paying for — fewer metadata writes means fewer network round trips to the provider — at the cost of breaking <code>last access</code> time-based tools. <strong>Use <code>noatime</code> on write-heavy or IOPS-capped volumes; use <code>lazytime</code> if you want atime for tools that need it, because it keeps the data on disk and only refreshes it on unmount or a copy.</strong>",
          "<code>discard</code> tells the device to discard blocks on <code>unlink</code>. <code>fstrim</code> does the same in bulk, either from <code>fstrim.timer</code> (systemd 237 on Ubuntu 18.04 ships that unit — run <code>systemctl list-timers fstrim</code>) or from <code>systemd-fstrim.service</code> after a cron run. Do not do both: discard-on-unlink costs a network round trip per deletion on a cloud volume, and on a virtual device it frequently does nothing because the hypervisor handles TRIM itself. The default answer on Ubuntu is to leave <code>discard</code> off in <code>fstab</code> and let <code>fstrim.timer</code> run weekly.",
          "<code>noexec</code> refuses to execute a binary from the filesystem; <code>nosuid</code> ignores the setuid and setgid bits; <code>nodev</code> refuses to honour device files. On a <code>/tmp</code> that any unprivileged user can write to, <code>nodev,nosuid,noexec</code> is a genuine security control and it costs nothing: it closes off the standard <code>/tmp</code> abuse patterns — writing a <code>.so</code> and having something load it, copying a setuid binary and executing it, creating <code>/tmp/kmem</code> as a device for a kernel exploit. Ubuntu's own <code>/tmp</code> is a systemd tmpfs since 16.04 (<code>tmp.mount</code>) and carries <code>nr_inode=1048576,inode64</code>, but the <code>nodev,nosuid</code> flags on <code>/dev/shm</code> come from <code>systemd</code> itself and are the reason that path stays closed by default.",
          "One more to know: <code>ro</code> on a <code>/usr</code> mount. Immutable operating-system partitions make a compromised root process unable to rewrite its own tooling, and systemd will refuse to service-failure-restart units that need to write there. Useful on a build host; usually just friction on a small VPS."
        ]
      },
      {
        type: "table",
        cols: ["Option", "What the kernel does", "Use it when", "Cost of getting it wrong"],
        rows: [
          ["<code>noatime</code>", "Skips the inode atime write on read, saving one metadata update per read-mostly file.", "NOATIME or <code>lazyatime</code> on an IOPS-capped cloud volume.", "<code>ls -lu</code> shows 1970. Incremental backup tools that select by atime stop finding files."],
          ["<code>discard</code>", "Issues a TRIM/unmap for every freed block, synchronously.", "Almost never on cloud disks — <code>fstrim.timer</code> weekly is cheaper.", "One extra round trip per deletion; on a busy build host it visibly slows <code>rm</code>."],
          ["<code>noexec</code>", "Returns <code>EACCES</code> from <code>execve</code> on any file on that mount.", "<code>/tmp</code>, <code>/var/tmp</code>, network mounts you only read data from.", "An initramfs or rescue script placed on that mount silently fails to run."],
          ["<code>nosuid</code>", "Ignores the setuid/setgid bit when executing.", "<code>/tmp</code>, <code>/dev/shm</code>, anything world-writable.", "A program you need to run with privileges that you installed on that mount stops elevating." ],
          ["<code>nodev</code>", "Ignores device nodes as open targets.", "<code>/tmp</code>, <code>/dev/shm</code>, any data mount.", "Very little. Rarely breaks anything real; blocks a real exploit class."],
          ["<code>errors=remount-ro</code>", "On a fatal FS error, remount read-only instead of continuing.", "The default on ext4; keep it.", "Services fail fast with <code>EIO</code> instead of writing corruption — this is what you want."],
          ["<code>barrier</code> / <code>nobarrier</code>", "Forces (or skips) device cache flushes around journal commits.", "Leave it alone on anything virtual or SSD.", "<code>nobarrier</code> on a lying cache is how a clean shutdown produces a corrupt filesystem."],
          ["<code>x-systemd.automount</code>", "systemd mounts the unit on first access to the path, not at boot.", "Slow or flaky remote mounts you do not always need.", "First access to the path blocks until the mount lands. Watch for that with <code>systemctl list-units --type=automount</code>."]
        ]
      },
      {
        type: "prose",
        h: "/etc/fstab, field by field — and why one bad line bricks a remote box",
        p: [
          "Every line is six whitespace-separated fields. <code>UUID=9f2c1d84-2b1e-4f0a-9c33-6d5a1e77b210 / ext4 errors=remount-ro 0 1</code> parses as: device; mountpoint; type; options; dump frequency; fsck pass order. The <code>UUID=</code> prefix is not decoration — it tells <code>mount</code> to resolve that token against <code>/dev/disk/by-uuid/</code> rather than treat the rest as a path. Get the UUID from <code>blkid</code>, never from memory, and never hard-code <code>/dev/vda1</code> when a UUID exists: the ordering of <code>/dev/sd*</code> is a race, and a reboot after adding a disk is exactly when it bites you.",
          "The <code>0 1</code> at the end is legacy. The fifth field is the dump frequency used by <code>dump</code>, and on a systemd system <code>/etc/fstab</code> is the only thing it configures. The sixth is the fsck pass: <code>1</code> means check root, <code>2</code> means check any other filesystem. On systemd you normally want <code>0</code> in both and let <code>systemd-fsck@.service</code> handle it — but the legacy value is still how systemd derives which units get automatic checks.",
          "The two options that save remote machines: <strong><code>nofail</code></strong> tells systemd not to treat a failed mount as a boot failure, so the box still comes up (with the directory empty, which is its own hazard — an empty <code>/var</code> that is supposed to be a data disk); <strong><code>_netdev</code></strong> marks the mount as requiring network, so systemd orders it after networking instead of before, rather than timing out and dropping you to emergency mode. Prefix a remote mount with <code>x-systemd.automount</code> as well if it is on an unreliable link.",
          "Now the part that matters on a Tailscale-only, key-only VPS: if you add an <code>fstab</code> line referencing a device or UUID that does not exist, systemd cannot mount it, considers the boot failed, and drops to <code>emergency.target</code> — which on <code>ubuntu-2gb-hel1-1</code> means a serial console you do not have. Append the line, not edit in place; keep the current SSH session open; run <code>sudo findmnt --verify --verbose</code> before rebooting; and have a provider console available. This is the single most common way a competent administrator takes a working server offline."
        ]
      },
      {
        type: "diagram",
        h: "One fstab line becomes a systemd unit, with a dependency graph",
        caption: "systemd-fstab-generator reads <code>/etc/fstab</code> at boot and writes a <code>*.mount</code> unit per line into <code>/run/systemd/generator/</code>. <b>local-fs.target</b> gates multi-user.target for local filesystems; <b>remote-fs.target</b> and <b>swap.target</b> are separate. A missing <code>nofail</code> is what turns a failed mount into emergency.target.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="fstab line parsed into six fields and generated into a systemd mount unit with dependency targets">
  <text class="t-title" x="40" y="34">/etc/fstab -&gt; fstab-generator -&gt; a unit the dependency graph knows about</text>

  <rect class="box" x="40" y="54" width="1020" height="44" rx="8"/>
  <text class="t-mono" x="60" y="82" font-size="15">UUID=9f2c1d84-2b1e-4f0a-9c33-6d5a1e77b210  /var/lib/docker  ext4  defaults,nofail  0  2</text>

  <text class="t-xs t-dim" x="60" y="118">1 source</text>
  <text class="t-xs t-dim" x="300" y="118">2 mountpoint</text>
  <text class="t-xs t-dim" x="470" y="118">3 fstype</text>
  <text class="t-xs t-dim" x="600" y="118">4 options</text>
  <text class="t-xs t-dim" x="860" y="118">5 dump</text>
  <text class="t-xs t-dim" x="960" y="118">6 fsck order</text>

  <line class="ln-a" x1="70" y1="98" x2="70" y2="128" stroke-width="1.5"/>
  <line class="ln-a" x1="310" y1="98" x2="310" y2="128" stroke-width="1.5"/>
  <line class="ln-a" x1="480" y1="98" x2="480" y2="128" stroke-width="1.5"/>
  <line class="ln-a" x1="610" y1="98" x2="610" y2="128" stroke-width="1.5"/>
  <line class="ln-a" x1="870" y1="98" x2="870" y2="128" stroke-width="1.5"/>
  <line class="ln-a" x1="970" y1="98" x2="970" y2="128" stroke-width="1.5"/>

  <path class="ln-a" d="M550,132 L550,164" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm t-dim" x="566" y="154">systemd-fstab-generator, runs before any unit is started</text>

  <rect class="box-a" x="40" y="168" width="1020" height="72" rx="10"/>
  <text class="t-accent" x="60" y="194" font-size="15">/run/systemd/generator/var-lib-docker.mount</text>
  <text class="t-sm" x="60" y="218">[Unit] Description=/var/lib/docker  [Mount] What=/var/lib/docker Where=/var/lib/docker Type=ext4 Options=defaults,nofail</text>
  <text class="t-xs t-dim" x="60" y="234">A path with slashes becomes a name with dashes and the leading slash dropped. That is the entire naming rule.</text>

  <line class="ln-w dash" x1="40" y1="266" x2="1060" y2="266" stroke-width="2"/>
  <text class="t-warn" x="40" y="290" font-size="15">the dependency graph systemd builds from that unit</text>

  <rect class="box" x="40" y="308" width="200" height="60" rx="10"/>
  <text class="t-sm" x="140" y="334" text-anchor="middle">systemd-remount-fs.service</text>
  <text class="t-xs t-dim" x="140" y="354" text-anchor="middle">applies the real mount options</text>

  <rect class="box-v" x="286" y="308" width="200" height="60" rx="10"/>
  <text class="t-violet" x="386" y="334" text-anchor="middle">local-fs.target</text>
  <text class="t-xs t-dim" x="386" y="354" text-anchor="middle">root + /usr + /var</text>

  <rect class="box-v" x="532" y="308" width="200" height="60" rx="10"/>
  <text class="t-violet" x="632" y="334" text-anchor="middle">systemd-fsck@.service</text>
  <text class="t-xs t-dim" x="632" y="354" text-anchor="middle">runs fsck -n per fsck order</text>

  <rect class="box-w" x="778" y="308" width="282" height="60" rx="10"/>
  <text class="t-warn" x="919" y="334" text-anchor="middle">remote-fs.target  /  swap.target</text>
  <text class="t-xs t-dim" x="919" y="354" text-anchor="middle">anything with _netdev</text>

  <rect class="box-ok" x="40" y="392" width="200" height="60" rx="10"/>
  <text class="t-ok" x="140" y="418" text-anchor="middle">sysinit.target</text>
  <text class="t-xs t-dim" x="140" y="438" text-anchor="middle">earliest boot phase</text>

  <rect class="box-b" x="286" y="392" width="200" height="60" rx="10"/>
  <text class="t-bad" x="386" y="418" text-anchor="middle">emergency.target</text>
  <text class="t-xs t-dim" x="386" y="438" text-anchor="middle">when a mount has no nofail</text>

  <rect class="box-ok" x="532" y="392" width="200" height="60" rx="10"/>
  <text class="t-ok" x="632" y="418" text-anchor="middle">multi-user.target</text>
  <text class="t-xs t-dim" x="632" y="438" text-anchor="middle">sshd and nginx start here</text>

  <rect class="box-ok" x="778" y="392" width="282" height="60" rx="10"/>
  <text class="t-ok" x="919" y="418" text-anchor="middle">network-online.target</text>
  <text class="t-xs t-dim" x="919" y="438" text-anchor="middle">required by _netdev, waits for Tailscale</text>

  <path class="ln" d="M140,368 L140,388" marker-end="url(#lm-arrow)"/>
  <path class="ln-b" d="M386,368 L386,388" marker-end="url(#lm-arrow-bad)"/>
  <path class="ln-ok" d="M632,368 L632,388" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln" d="M919,368 L919,388" marker-end="url(#lm-arrow)"/>
  <path class="ln-a" d="M244,338 L282,338" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M490,338 L528,338" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-b" x="40" y="480" width="1020" height="96" rx="8"/>
  <text class="t-bad" x="60" y="506" font-size="15">the failure, concretely</text>
  <text class="t-sm" x="60" y="530">$ sudo mount -a   # do this BEFORE rebooting, every time</text>
  <text class="t-sm" x="60" y="552">mount: /var/lib/docker: special device /dev/vdb does not exist  -&gt;  append nofail to the line, or the next boot lands in emergency.target</text>
  <text class="t-xs t-dim" x="60" y="572">$ sudo findmnt --verify --verbose   # parses fstab, resolves UUIDs, reports every entry without mounting</text>
</svg>`
      },
      {
        type: "code",
        lang: "conf",
        what: "A fstab that survives a reboot on a 2 GB VPS with a separate data disk, and the verification commands that catch mistakes before they matter.",
        code: `# /etc/fstab
# <file system>              <mount point>  <type>  <options>                        <dump>  <pass>

# root: UUID copied from blkid, never guessed. errors=remount-ro is the ext4 default and worth keeping.
UUID=9f2c1d84-2b1e-4f0a-9c33-6d5a1e77b210  /      ext4  errors=remount-ro            0       1

# tmpfs /run and /dev/shm: systemd mounts these itself from tmp.mount and
# systemd-tmpfiles-setup.service; declaring them again is a duplicate-unit warning.
/dev/sda1      none   swap  sw                          0       0

# data disk: nofail means a failure here does not drop the box to emergency.target.
#             _netdev would be wrong here (local disk) but is mandatory on NFS.
UUID=7b21cc04-3e88-4a17-b0c2-5d1e9f30aa71  /var/lib/docker  ext4  defaults,nofail,noatime  0  2

# a remote mount: x-systemd.automount keeps it out of boot entirely, _netdev orders
# it after networking instead of before. Both, for a link that comes up late.
// server:/export/backups   /mnt/backups  nfs4  _netdev,x-systemd.automount,ro,nofail  0  0

# verify before rebooting. --verify resolves every UUID and reports, but does not mount.
$ sudo findmnt --verify --verbose
$ sudo mount -a && echo "all entries mounted"
$ systemctl daemon-reload
$ sudo systemctl restart systemd-remount-fs

# what systemd generated, and whether it is currently active
$ systemctl show var-lib-docker.mount -p Requires -p After -p What -p Options
$ findmnt /var/lib/docker`
      },
      {
        type: "prose",
        h: "Growing online, and the one filesystem that refuses to shrink",
        p: [
          "Growing a cloud volume is a three-step operation, and each step belongs to a different layer. First the provider enlarges the block device — on this class of VPS that is a control-panel action, sometimes followed by a reboot. Second, you extend the partition table so it describes the new size. Third, you grow the filesystem inside it. Skipping step 2 is the classic mistake, and it produces <code>Partition table entries are not in sync with disk</code> on the next boot: the kernel sees 19&nbsp;GiB of sectors, the table still ends at 5&nbsp;GiB, and everything is inconsistent even though the disk is fine.",
          "The partition step is <code>growpart</code> from cloud-utils, run against the partition, not the disk: <code>sudo growpart /dev/vda 1</code>. It rewrites the GPT backup header at the end of the disk to match, which is the part <code>fdisk</code> in non-interactive mode historically got wrong. If <code>growpart</code> is not installed, <code>parted</code> works: <code>sudo parted -s /dev/vda resizepart 1 100%</code>, followed by <code>partprobe</code> or a <code>partx -u</code> to make the running kernel re-read it. If the partition is in use you will get <code>Device or resource busy</code> on <code>losetup</code>/<code>partprobe</code>; that is expected, and the kernel picks up the new geometry at the next reboot.",
          "Then the filesystem, per type: <code>sudo resize2fs /dev/vda1</code> for ext4, which is safe online and is the one to run while mounted. For XFS, <code>sudo xfs_growfs /mountpoint</code> — note it takes the <em>mountpoint</em>, not the device, which is a detail that produces a lot of confusion. For btrfs, <code>sudo btrfs filesystem resize max /mountpoint</code>, and with no <code>-m</code> argument it also grows every subvolume. For LVM in between, <code>lvresize -l +100%FREE</code> then the filesystem command on <code>/dev/mapper/vg0-name</code>.",
          "And the asymmetry to internalise: <strong>ext4 can shrink, but only while unmounted</strong>, and you must run <code>e2fsck -f /dev/sda1</code> first to move data off the tail. <strong>XFS cannot shrink at all.</strong> There is no such thing as <code>xfs_shrink</code>. If you sized a data volume at 100&nbsp;GB and you now need 10, your only options are to copy the data into a new smaller filesystem, or to keep the volume and shrink a different layer (an LVM LV above it, or the partition below it, neither of which helps XFS). Design around that now rather than discovering it."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The complete online growth sequence for the four filesystems, including the growpart step people forget and the verification that tells you the kernel noticed.",
        code: `# 1. provider resizes the volume (control panel / API), then confirm the kernel sees it
$ lsblk
NAME   MAJ:MIN RM SIZE RO TYPE MOUNTPOINT
vda      253:0    0  19G  0 disk
└─vda1   253:1    0  5G  0 part /
$ cat /sys/block/vda/size
9961472          # 512-byte sectors = 4.7G - the device is still small

# ... after the provider resized it:
$ cat /sys/block/vda/size
39845888         # 19 GiB in sectors. The block layer already knows.
$ lsblk
vda      253:0    0  19G  0 disk
└─vda1   253:1    0  5G  0 part /     # partition table still says 5G - step 2

# 2. grow the partition. growpart takes the PARTITION NUMBER, not the disk.
$ sudo apt-get install -y cloud-guest-utils
$ sudo growpart /dev/vda 1
  CHANGED: partition 1 is now 39845887 sectors (19 GiB)
$ sudo partprobe /dev/vda      # busy if / is mounted; harmless, kernel re-reads at reboot
$ lsblk
└─vda1   253:1    0  19G  0 part /     # table now agrees with the device

# no growpart? parted does the same thing
$ sudo parted -s /dev/vda resizepart 1 100%
$ sudo partx -u /dev/vda

# 3. grow the filesystem, mounted, online
$ sudo resize2fs /dev/vda1          # ext4
  resize2fs 1.0.44 Ubuntu 18.04.6 (2 Dec 2017)
  Resizing the filesystem on /dev/vda1 to 39132160 (4k) blocks.
  The filesystem on /dev/vda1 is now 39132160 (4k) blocks long.

$ sudo xfs_growfs /                 # XFS: MOUNTPOINT, not device. There is no xfs_shrink.
$ sudo btrfs filesystem resize max /   # btrfs: grows every subvolume too

$ df -hT /
Filesystem     Type  Size  Used Avail Use% Mounted on
/dev/vda1      ext4   19G  4.6G   14G  25% /

# shrinking ext4: only unmounted, and only after a forced check
$ sudo umount /dev/sdb1
$ sudo e2fsck -f /dev/sdb1
$ sudo resize2fs /dev/sdb1 4G
$ sudo mount /dev/sdb1`
      },
      {
        type: "prose",
        h: "Swap and the OOM killer: the same problem, two different symptoms",
        p: [
          "When the kernel cannot satisfy a page allocation, it has two responses and picks between them. If there is reclaimable memory — clean page cache, or anonymous pages on swap it can page out — it <strong>reclaims</strong>, and your application slows down. If there is nothing left to reclaim, it <strong>invokes the OOM killer</strong>, which picks a process by a scoring function that favours large RSS, many faults and swap usage, and kills it with SIGKILL. SIGKILL cannot be caught, blocked or handled. The kernel log says <code>Out of memory: Killed process 4211 (java) total-vm:…</code> and nothing else useful.",
          "The reason swap changes the outcome so drastically on a small box is that swapping anonymous memory is <em>not free and not fast</em>. Every page-out is a synchronous write to a block device, and on a cloud volume that is a network round trip measured in milliseconds. Once a workload is in steady swap, each page-in is that same round trip, so the process spends nearly all of its time blocked on I/O, allocating again immediately after freeing, and paging out again. That is <strong>thrash</strong>, and it presents as a machine that is 100% CPU busy, unresponsive to SSH, with full disks and no OOM kill in <code>dmesg</code>.",
          "On the 2&nbsp;GB reference machine the arithmetic is unforgiving. <code>free -h</code> showing 200&nbsp;MB free with 900&nbsp;MB in <code>buff/cache</code> is <em>healthy</em> — the cache is reclaimable and the kernel will take it without complaint. The number to watch is <code>available</code>, which is the kernel's own estimate of what a new process could get without swapping: <code>free -h</code> on 18.04 prints it. And <code>vmstat 1</code> prints the two columns that tell you which regime you are in: <strong><code>si</code> (swap-in) and <code>so</code> (swap-out)</strong>, reported per second. Sustained non-zero <code>so</code> with high <code>wa</code> is thrash. Persistent non-zero <code>si</code> with <code>so</code> at zero is a process whose working set genuinely does not fit, and adding RAM is the only fix — no amount of tuning changes that.",
          "A swap file does not fix an OOM. It converts a clean, diagnosable kill into an undiagnosable slowdown, and it turns an instant crash into a timeout that takes your SSH session with it. Add swap when you want the machine to survive a memory spike with a clear error — a compile that briefly needs 3&nbsp;GB, a <code>tar</code> with a large buffer — and size it deliberately. Never add swap to paper over a leak, and never add swap because it feels safer."
        ]
      },
      {
        type: "diagram",
        h: "Reclaim, swap-out, thrash, kill: the allocation failure decision",
        caption: "The kernel reclaims page cache first because it is provably discardable. Anonymous memory is different — reclaiming it means writing it out, which is why <b>swap converts a fast failure into a slow one</b>. <code>vmstat</code> <code>si</code>/<code>so</code> and <code>free -h</code> <code>available</code> are the two readings that tell you which branch you are on.",
        svg: `
<svg viewBox="0 0 1100 540" role="img" aria-label="Kernel memory allocation failure decision tree from page fault through reclaim, swap out and OOM kill">
  <text class="t-title" x="40" y="34">A PAGE ALLOCATION FAILS - what the kernel does next</text>

  <rect class="box-a" x="400" y="56" width="300" height="64" rx="10"/>
  <text class="t-accent" x="550" y="82" text-anchor="middle" font-size="15">allocation failed (GFP_ATOMIC, no pages)</text>
  <text class="t-xs t-dim" x="550" y="104" text-anchor="middle">kmem, page cache, anonymous fault</text>

  <path class="ln-a" d="M550,120 L550,150" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="566" y="142">try direct reclaim</text>

  <rect class="box-v" x="380" y="154" width="340" height="64" rx="10"/>
  <text class="t-violet" x="550" y="180" text-anchor="middle" font-size="15">is there clean page cache?</text>
  <text class="t-xs t-dim" x="550" y="202" text-anchor="middle">free + available in free -h</text>

  <path class="ln-ok" d="M450,218 L240,218 L240,252" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="470" y="238">yes - drop it, retry</text>

  <rect class="box-ok" x="90" y="256" width="300" height="88" rx="10"/>
  <text class="t-ok" x="110" y="282" font-size="15">RECLAIM</text>
  <text class="t-xs" x="110" y="304">evict clean cache pages.</text>
  <text class="t-xs" x="110" y="322">Free drops, Available stays.</text>
  <text class="t-xs" x="110" y="340">This is the healthy state.</text>

  <path class="ln-w" d="M550,218 L550,252" marker-end="url(#lm-arrow-warn)"/>
  <text class="t-warn" x="566" y="238">no</text>

  <rect class="box-w" x="400" y="256" width="340" height="88" rx="10"/>
  <text class="t-warn" x="420" y="282" font-size="15">is there reclaimable anon + swap?</text>
  <text class="t-xs" x="420" y="304">vmstat 1  - watch the so column</text>
  <text class="t-xs" x="420" y="322">free -h  - watch Swap: used</text>
  <text class="t-xs" x="420" y="340">a swapfile on / is the trigger</text>

  <path class="ln-w" d="M490,344 L300,344 L300,382" marker-end="url(#lm-arrow-warn)"/>
  <text class="t-warn" x="330" y="368">yes - page it out</text>

  <rect class="box-b" x="90" y="386" width="330" height="112" rx="10"/>
  <text class="t-bad" x="110" y="412" font-size="15">SWAP OUT - and now you thrash</text>
  <text class="t-xs" x="110" y="436">every page-out is a synchronous write</text>
  <text class="t-xs" x="110" y="454">to a network-backed volume</text>
  <text class="t-xs" x="110" y="476">vmstat: so &gt; 0, wa climbing, r high</text>
  <text class="t-xs" x="110" y="492">no OOM kill - just no progress</text>

  <path class="ln-b" d="M650,344 L790,344 L790,382" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="800" y="368">no swap at all</text>

  <rect class="box-b" x="700" y="386" width="360" height="112" rx="10"/>
  <text class="t-bad" x="720" y="412" font-size="15">OOM KILLER - SIGKILL, uncatchable</text>
  <text class="t-xs" x="720" y="436">dmesg: Out of memory: Killed</text>
  <text class="t-xs" x="720" y="454">process 4211 (java) total-vm:…</text>
  <text class="t-xs" x="720" y="476">unit shows status=137/KILL</text>
  <text class="t-xs" x="720" y="492">Under cgroups v1, check memory.failcnt</text>

  <path class="ln" d="M255,344 L255,520" stroke-dasharray="4 4"/>
  <path class="ln" d="M880,498 L880,520" stroke-dasharray="4 4"/>

  <text class="t-sm t-dim" x="40" y="528">swappiness=10 on a small box keeps the kernel from swapping early; sysctl vm.swappiness is per-boot-tunable, /etc/sysctl.d/ is where it belongs</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Read the swap columns directly, then create swap deliberately with a permission-correct swapfile.",
        code: `# si = swap-in per second, so = swap-out per second, wa = iowait
$ vmstat 1
procs -----------memory---------- ---swap-- -----io---- -vm-- ---------timers---------
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 2  0  10240  131072  16384 183500    0    0     0   104    0    3  1  1 97  0  0
 2  0  10240  120832  16384 184320    0    0     0     0    0    3  1  1 97  0  0
 3  1  24576   4096  12288 176640   16    0     0    24    0    5  8  2 82  8  0
#          ^^ si=16 with so=0 : the working set does not fit. Add RAM, not tuning.

# the thrash signature: so stays positive, wa sits above 20, nothing progresses
 1  9 2088960  2048   4096  65536  112  340     0   1140    0   22  2  9  3 86  0
#            ^^^^^^^^^ 96% of 2 GB resident in swap

# cgroups v1 memory accounting for a container that died
$ cat /sys/fs/cgroup/memory/docker/$(docker inspect -f "{{.State.Oid}}" nginx)/memory.max_usage_in_bytes
$ cat /sys/fs/cgroup/memory/docker/$(docker inspect -f "{{.State.Oid}}" nginx)/memory.failcnt
$ cat /sys/fs/cgroup/memory/docker/$(docker inspect -f "{{.State.Oid}}" nginx)/memory.oom_control

# create a swapfile properly. The permission step is not optional:
# mkswap refuses it, and running it as world-writable is how people create a root shell for anyone.
$ sudo fallocate -l 2G /swapfile
$ sudo chmod 600 /swapfile
$ sudo mkswap /swapfile
  Setting up swapspace version 1, size = 2097148 KiB
  mkswap: /swapfile: insecure permissions on file (0644), change to 0600 to continue
$ sudo mkswap /swapfile          # after the chmod
$ sudo swapon /swapfile
$ echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
$ sysctl vm.swappiness=10 && echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
$ swapon --show
NAME      TYPE  SIZE USED PRIO
/swapfile file    2G   0B   -2`
      },
      {
        type: "prose",
        h: "Disk full triage: four different problems wearing the same error string",
        p: [
          "<code>ENOSPC</code> is a misleading error. It means 'this filesystem cannot satisfy this allocation', and on a modern filesystem that includes inode exhaustion, not just bytes. Four distinct problems produce it, and each needs a different command.",
          "First, <strong>bytes</strong>. <code>df -hT</code> tells you which filesystem is full; <code>du -x -h --max-depth=1 / | sort -h</code> walks it. The <code>-x</code> is essential — without it, <code>du</code> follows into other mounted filesystems and attributes their size to the path you are measuring, which is how <code>/var</code> appears to contain a 19&nbsp;GB root. On a 19&nbsp;GB box, <code>ncdu -x /</code> with its interactive interface beats <code>du</code> once you are past the first three directories.",
          "Second, <strong>deleted-but-open files</strong>. <code>df</code> shows the space as used, <code>du</code> cannot find it, and no amount of deleting will help. The kernel frees a file's data when the last <em>reference</em> goes away, and an open file descriptor is a reference — a deleted log file that a process is still appending to keeps every block it has ever written allocated. This is the single most common confusing disk-full on production servers, and the reason a restarted service appears to fix a full disk with no explanation. <code>sudo lsof +L1</code> lists every open file with a link count below 1, ordered by size.",
          "Third, <strong>inodes</strong>. <code>df -i</code> shows usage as a percentage of inodes rather than blocks. A directory with several million small files exhausts inodes while <code>df</code> reports 4% used — sessions, mail spools, <code>rsync</code> into a directory with a hardlinked release tree, and PHP session files are the classic sources. ext4 sizes its inode table at <code>mkfs</code> time (about 1 inode per 16&nbsp;KiB on 18.04), so this is fixed at format time, not tunable afterwards.",
          "Fourth, <strong>the things that are not files</strong>: journald's binary journal under <code>/var/log/journal</code>, Docker's <code>/var/lib/docker</code> (overlay2 layers, container logs under <code>/var/lib/docker/containers/&lt;id&gt/&lt;id&gt;-json.log</code> which grow without limit unless <code>log-driver</code> says otherwise), and package caches. On the reference box <code>/var/log</code> is capped at <code>SystemMaxUse=300M</code> plus <code>SystemKeepFree=1G</code>, so journald will never be the cause — but it will be the cause on a box where nobody set that."
        ]
      },
      {
        type: "steps",
        items: [
          { t: "df -hT, then df -i, on every mounted filesystem", d: "Establish which filesystem and whether you are out of bytes or out of inodes. Exclude pseudo-filesystems so the output is readable: df -hT -x tmpfs -x devtmpfs -x squashfs. If two filesystems share a mount point, use -x to drop the one behind." },
          { t: "sudo lsof +L1", d: "Catch deleted-but-open files before you walk the tree. Anything with a large SIZE column under a deleted name is your missing space. The fix is to restart or re-open the holder - lsof -p PID to identify it - not to delete anything else." },
          { t: "du -x --max-depth=1 / | sort -h", d: "Walk the real consumer, staying on one filesystem with -x. Then descend. Replace this with ncdu -x / when the tree is large enough to be tedious." },
          { t: "journalctl --disk-usage, then journalctl --vacuum-size=200M", d: "journald's own accounting. Vacuum works on a running system and only removes archived journals, never the active one, so it is safe. Note that journalctl --vacuum-time is relative to now and will not touch an active journal." },
          { t: "docker system df, then docker system prune", d: "Shows images, containers, volumes and build cache separately. docker system prune removes stopped containers and unused networks, not volumes - docker volume prune is separate and irreversible for named volumes." },
          { t: "du -sh /var/cache/apt/archives/*.deb | wc -l, then sudo apt-get clean", d: "Debian and Ubuntu keep every downloaded .deb here. apt-get clean removes the debs; apt-get autoclean removes only the ones no longer in any configured repository. Both are safe; neither touches installed packages." },
          { t: "Confirm the headroom, and fix the cause", d: "Re-run df. On the reference box the 16 unpruned docroot backups in /var/www/html are ~374 MB of the 4.6 GB used - which is the point. A backup strategy with no retention is not a backup strategy, it is a disk-filling strategy." }
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The four triage commands, in the order you should run them, plus the safe-to-delete set on Debian and Ubuntu.",
        code: `# 1. which filesystem, bytes or inodes?
$ df -hT -x tmpfs -x devtmpfs -x squashfs -x overlay
$ df -i  /var/lib/docker
Filesystem      Inodes  IUsed IFree IUse% Mounted on
/dev/vda1      1179648 412331 767317   36% /

# 2. deleted but open - the space df reports and du cannot find
$ sudo lsof +L1 | head -5
COMMAND   PID USER  FD   TYPE DEVICE    SIZE/OFF NLINK NODE NAME
nginx    1204 root  14w   REG  253,1  104857600     0 6291 /var/log/nginx/access.log (deleted)
rsync     3311 alex  3u   REG  253,1   52428800     0 9930 /var/www/html/.site.tgz (deleted)
# 100 MB of nginx log that was deleted an hour ago and is still being appended to.
# The fix is restarting nginx, not deleting anything.
$ sudo lsof -p 1204 | grep deleted

# 3. walk it, staying on one filesystem
$ sudo du -x -h --max-depth=1 / | sort -h
$ sudo ncdu -x /var/www/html          # interactive, and the fastest way through 16 backup trees
$ du -sh /var/www/html/*/ | sort -h | tail
48M     /var/www/html/site-a/
312M    /var/www/html/site-b/
14M     /var/www/html/site-c/

# 4. journald
$ journalctl --disk-usage
Archived and active journals take up 118.4M on disk.
$ sudo journalctl --vacuum-size=200M
$ grep -r SystemMaxUse /etc/systemd/journald.conf
#SystemMaxUse=300M  SystemKeepFree=1G  <- what the reference box runs

# 5. docker
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          14        4         2.71GB    1.93GB
Containers      6         1         42.1MB    42.1MB
Local Volumes   3         3         0B        0B
Build Cache     27        0         884MB     884MB
$ docker system prune -f              # stopped containers, dangling images, networks, build cache
$ docker builder prune -f             # build cache only, safe to run any time
$ du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail -3
$ journalctl CONTAINER_NAME=nginx --disk-usage   # what a container has actually logged

# 6. package cache - both of these are safe
$ du -sh /var/cache/apt/archives
$ sudo apt-get clean        # all cached debs
$ sudo apt-get autoclean    # only debs no longer in any configured repo
$ sudo apt-get autoremove --dry-run

# 7. what is NOT safe to delete by hand
#    /var/lib/docker/* - deletes images and running container filesystems
#    /var/lib/lvm - destroys volume group metadata
#    anything under /var/lib/mysql or /var/lib/postgresql - that is the database
#    /dev/* - you are holding the device nodes the system is currently using`
      },
      {
        type: "prose",
        h: "fsck: when the kernel runs it for you",
        p: [
          "<code>fsck</code> is not one program. It is a dispatcher — <code>fsck /dev/vda1</code> looks up which filesystem the superblock says it is and execs <code>fsck.ext4</code>, <code>fsck.xfs</code>, <code>fsck.btrfs</code> or <code>fsck.vfat</code>. Each one takes a different view of consistency, and the differences matter.",
          "<strong>ext4 with a journal</strong> replays the journal at mount and fixes itself. A clean unmount leaves the journal empty and there is nothing to do. An unclean one produces <code>EXT4-fs (vda1): recovery complete</code> in <code>dmesg</code> and the system carries on — that is the journal earning its keep. <code>fsck.ext4</code> on a mounted filesystem returns <code>fsck: /dev/vda1 is mounted.  fsck.ext4: refusing to work on a mounted filesystem.</code> because checking a live filesystem examines structures the kernel is concurrently modifying; the check itself corrupts data. To force a check of a root filesystem you use <code>tune2fs -c 30 /dev/vda1</code> (mount count) or <code>tune2fs -i 30d</code> (interval) to schedule one at the next boot, then reboot into it.",
          "<strong>XFS refuses to be checked while mounted, full stop</strong>, and <code>xfs_repair</code> must run on an unmounted filesystem. If the root XFS filesystem is damaged and you have no second disk, you boot with <code>init=/bin/bash</code> from the GRUB menu, remount <code>/</code> read-write, unmount it, run the repair, and reboot. That is a very different amount of pain than ext4's automatic journal replay.",
          "<strong>systemd-fsck@.service</strong> is the mechanism that makes this happen automatically, and it is worth understanding because it is what you are relying on when you do nothing. At boot, <code>systemd-fsck-root.service</code> and the templated <code>systemd-fsck@.service</code> run <code>fsck -n</code> (<strong>no</strong>, never <code>-a</code> or <code>-y</strong> — systemd wants the answer, not for systemd to repair) against each filesystem, triggered by the generated <code>*.mount</code> units. A clean exit is invisible. An exit code of 4 means 'errors left uncorrected', and systemd will refuse that mount and continue without it rather than risk making it worse. Change the behaviour with <code>systemctl set-default fsck.mode=force</code> or by setting <code>pass</code> to <code>0</code> in <code>fstab</code> — and understand that <code>pass 0</code> means this safety net is off for that filesystem."
        ]
      },
      {
        type: "prose",
        h: "Block performance: what the disk is actually rated for",
        p: [
          "Every storage device has a <strong>queue</strong> — a number of I/O requests it can have in flight at once — and that number is its parallelism. <strong>Queue depth</strong> is how full you keep it. The relationship is the only thing you need: throughput approaches <code>IOPS = queue_depth / average_latency</code>, and latency improves only while the queue is not yet saturated. <code>IOPS = 1000 / await_ms</code> for a device with queue depth 1, and the number climbs as you add depth until you hit the device's limit and latency starts rising linearly. That is exactly the shape of the cloud-disk problem: your provider sells IOPS, the IOPS are a shared pool across the hypervisor host, and latency is what you actually feel.",
          "<code>iostat -x 1</code> prints the extended per-device statistics. The columns that matter, and what they mean when you are staring at them at 3am:",
          "<code>r/s</code> and <code>w/s</code> — completed reads and writes per second. <code>rkB/s</code>, <code>wkB/s</code> — throughput in kilobytes. If reads are low and <code>await</code> is high, you are not IO-bound, you are latency-bound — usually the queue is depth 1 or 2, which is what a database with a tiny queue looks like. If <code>aqu-sz</code> is around 1 and <code>r/s</code> is huge, you have plenty of spare device parallelism. <code>%util</code> — the fraction of time the device had at least one request in flight. <strong>It is not 'how busy' in the way you expect</strong>, because it saturates at 100% the moment the queue depth of 1 is full: a device doing 50&nbsp;000 IOPS with queue depth 32 shows 100% <code>%util</code> while nowhere near its limit. <code>%util</code> is a queue-depth-1 metric being read as if it were a capacity metric, which is the most common misreading of <code>iostat</code> there is. <code>aqu-sz</code> — average queue size, which combined with <code>r/s</code> and <code>await</code> gives you Little's Law: <code>throughput = IOPS x latency</code>. A rising <code>aqu-sz</code> with rising <code>await</code> is a saturated device and it will get worse under more load. <code>r_await</code> and <code>w_await</code> — read and write latency separately, and the gap between them is the whole story on an overloaded volume.",
          "And the warning: <code>fio</code> is the correct tool and it will absolutely take a production volume offline. A naive <code>fio</code> invocation writes gigabytes of random data to the target device as fast as it can go, and on a cloud volume that is a paid, shared, rate-limited resource — you will saturate the IOPS pool your database depends on, and the provider may rate-limit or flag the instance. If you must run it: target <code>/dev/shm</code> for a memory test, target a scratch volume you can afford to lose, use <code>--direct=1</code> so you measure the device and not the page cache, use <code>--filename</code> on a <em>file</em> rather than a raw device unless you intend to destroy the device, cap it with <code>--iodepth</code> and <code>--runtime</code>, and prefer <code>--readonly</code> against a device you cannot replace."
        ]
      },
      {
        type: "diagram",
        h: "Queue depth, latency, throughput - and where the cloud cap sits",
        caption: "Throughput is <code>IOPS x latency</code> (Little's Law). Adding depth raises IOPS until the device saturates; past that point latency rises one-for-one with depth and throughput is flat. On a VPS the saturation point is not your device - it is the provider's per-volume IOPS ceiling and the hypervisor's shared queue behind it.",
        svg: `
<svg viewBox="0 0 1100 540" role="img" aria-label="Queue depth to IOPS to latency saturation curve with iostat measurement points">
  <text class="t-title" x="40" y="34">the curve you are trying to locate</text>

  <line class="ln" x1="110" y1="440" x2="620" y2="440" stroke-width="2"/>
  <line class="ln" x1="110" y1="440" x2="110" y2="90" stroke-width="2"/>
  <text class="t-sm" x="365" y="470" text-anchor="middle">queue depth (aqu-sz)</text>
  <text class="t-sm" x="60" y="265" transform="rotate(-90 60 265)" text-anchor="middle">throughput / latency</text>

  <path class="ln-ok" d="M110,430 L300,330 L430,290 L520,282" stroke-width="2.5" fill="none"/>
  <text class="t-ok" x="250" y="316">throughput climbs with depth</text>

  <path class="ln-w" d="M520,282 L620,282" stroke-width="2.5" fill="none" stroke-dasharray="6 5"/>
  <text class="t-warn" x="500" y="266" text-anchor="middle">flat: saturated</text>

  <path class="ln-b" d="M520,282 L620,120" stroke-width="2.5" fill="none"/>
  <text class="t-bad" x="660" y="150">latency rises 1:1 with</text>
  <text class="t-bad" x="660" y="170">depth past saturation</text>
  <text class="t-xs t-dim" x="660" y="192">this is the region iostat shows as</text>
  <text class="t-xs t-dim" x="660" y="210">await climbing and aqu-sz pinned</text>

  <circle cx="200" cy="368" r="6" fill="var(--accent)"/>
  <text class="t-sm t-accent" x="196" y="392" text-anchor="middle">qd=1</text>
  <text class="t-xs t-dim" x="196" y="410" text-anchor="middle">a single-threaded read</text>
  <text class="t-xs t-dim" x="196" y="426" text-anchor="middle">%util = 100%</text>
  <text class="t-xs t-bad" x="196" y="442" text-anchor="middle">and it is NOT busy</text>

  <circle cx="430" cy="290" r="6" fill="var(--ok)"/>
  <text class="t-sm t-ok" x="440" y="322">where a healthy volume sits</text>

  <rect class="box-b" x="690" y="90" width="380" height="140" rx="10"/>
  <text class="t-bad" x="710" y="118" font-size="15">the cloud ceiling</text>
  <text class="t-sm" x="710" y="142">The provider meters IOPS per volume, and</text>
  <text class="t-sm" x="710" y="162">the hypervisor shares one physical queue</text>
  <text class="t-sm" x="710" y="182">across every VM on the node. A noisy</text>
  <text class="t-sm" x="710" y="202">neighbour moves your curve left.</text>
  <text class="t-xs t-dim" x="710" y="222">Your fio run is a real cost to everyone else.</text>

  <rect class="box" x="690" y="248" width="380" height="180" rx="10"/>
  <text class="t-title" x="710" y="276">READING IT BACK OUT OF iostat</text>
  <text class="t-sm" x="710" y="302">r/s  w/s         completed ops per second</text>
  <text class="t-sm" x="710" y="324">rkB/s wkB/s      throughput</text>
  <text class="t-sm" x="710" y="346">r_await w_await  service time per request</text>
  <text class="t-sm" x="710" y="368">aqu-sz          how full the queue is</text>
  <text class="t-sm" x="710" y="390">%util           at least one request in flight</text>
  <text class="t-xs t-dim" x="710" y="414">aqu-sz x 1/await == r/s. If those two do not</text>
  <text class="t-xs t-dim" x="710" y="428">agree, the sample interval was too short.</text>

  <text class="t-xs t-dim" x="110" y="500">Device: vda  r/s w/s  rkB/s wkB/s  r_await w_await  aqu-sz  %util</text>
  <text class="t-sm" x="110" y="522">vda     12   3   48.2   96.1      0.31    1.42     0.02   1.4</text>
  <text class="t-xs t-dim" x="110" y="540">%util 1.4% with aqu-sz 0.02: this device is idle. The latency is the number to read, not the utilisation.</text>
</svg>`
      },
      {
        type: "table",
        cols: ["Metric", "Formula / source", "Good", "Bad", "What the bad value usually means"],
        rows: [
          ["<code>%util</code>", "<code>(time device had &gt;=1 request in flight) / elapsed</code>", "under ~80%", "pinned at 100%", "<strong>Almost never means 'saturated'.</strong> It saturates at queue depth 1. A device at 100% <code>%util</code> with high <code>aqu-sz</code> is fine; the same number with <code>aqu-sz</code> of 1 is a single-threaded workload."],
          ["<code>await</code>", "<code>(read_time + write_time + in_flight) / (r/s + w/s)</code>", "under 10 ms on SSD, under 1 ms on NVMe", "100 ms+ sustained", "Queue full, or the backend is throttling. Check <code>aqu-sz</code> next: high + high = saturated device, low + high = the device is the floor, not the load."],
          ["<code>aqu-sz</code>", "Average requests in flight over the sample.", "30-64 on a healthy multi-threaded workload", "near 0 under load", "The device is starved of parallelism - either single-threaded access, or CPU-bound before it ever issues I/O. More queue depth will not help."],
          ["<code>r_await</code> vs <code>w_await</code>", "Service time, split by direction.", "roughly equal", "writes 5-10x reads", "Write pressure: fsync storms, a database checkpoint, a <code>rsync</code> of a large tree, or a cloud volume where write IOPS are provisioned lower than read IOPS."],
          ["<code>r/s</code> + <code>w/s</code>", "Completions per second, from /proc/diskstats.", "steady", "oscillating", "A workload that alternates between heavy read and heavy write is usually a backup or a cache flush, not organic traffic."],
          ["<code>%iowait</code> (<code>vmstat wa</code>)", "<code>time on D-state / total time</code>", "under 5%", "over 20%", "Tasks blocked in uninterruptible sleep. Check <code>so</code> too: high <code>wa</code> with high <code>so</code> is swap thrash, not disk IO."],
          ["<code>svctm</code>", "Average time in the device, per request.", "informational only", "ignore it", "Removed in sysstat 12 because it is unreliable on modern kernels. If a runbook tells you to watch <code>svctm</code>, the runbook is from 2015."]
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Measure before and after a change, and run fio with the guards that keep it off your production volume.",
        code: `# baseline: three samples so the first (averaged-since-boot) line is not misleading
$ sudo iostat -xz 1 3
Device  r/s   rkB/s   r_await  aqu-sz  %util
vda     3.00  12.02   0.31     0.00    1.40
vda     0.00   0.00   0.00     0.00    0.00

# the same numbers from /proc/diskstats, no package needed
$ grep ' vda ' /proc/diskstats
   8       0 vda 918273 41122 1105522  ...   # writes completed, sectors, ms spent writing

# iostat is in sysstat; the -x columns it prints depend on the version.
# -x for extended, -z to hide devices with no activity, -d for block only.

# fio: measure RAM safely first - no disk touched at all
$ fio --name=ramtest --ioengine=libaio --direct=0 \\
      --bs=1M --size=512M --iodepth=32 --rw=randread --runtime=20 --time_based \\
      --filename=/dev/shm/fio.tmp
# remove it afterwards; tmpfs pages count against your 2 GB

# fio against a FILE on a device you can afford to lose - not the raw device
$ fio --name=deletetest --filename=/var/tmp/fio.tmp --size=2G --direct=1 \\
      --rw=write --bs=64k --iodepth=16 --direct=1 --runtime=30 --time_based \\
      --group_reporting --gtod_reduce=1
  write: IOPS=4.9k, BW=301MiB/s (315MB/s)(8960MiB/30s)
# 4.9k IOPS at queue depth 16 on a 300 MiB/s volume: that is the provider's cap,
# not the disk. Compare against what you were sold before drawing a conclusion.

# NEVER: fio --filename=/dev/vda --rw=write --size=100% --direct=1
# That destroys the root filesystem, saturates a shared IOPS pool, and may
# get the instance rate-limited by the provider.`
      },
      {
        type: "prose",
        h: "Snapshots: cheap, instant, and not a backup",
        p: [
          "All three CoW-capable options make a snapshot nearly free, and all three do it the same way: instead of copying the data, note which blocks have changed since the snapshot, and copy only those when the snapshot is discarded. <strong>For an hour-old snapshot that is nearly zero bytes.</strong> That property is what makes 'snap before upgrade, snap before <code>apt</code>, snap before a risky <code>rsync</code>' a genuinely practical safety net rather than a scheduling exercise.",
          "LVM snapshots are metadata-only — <code>lvcreate -s -L 5G -n pre vg0/root</code> — but they require a snapshot volume, and CoW writes land on that volume first. Fill it and the snapshot <em>invalidates</em>, and every LV that depends on it becomes unusable. Size it for your write rate times your retention window, and alarm on <code>lvs</code> <code>data_percent</code> rather than discovering it from a boot failure. Linux also ships <code>dmsnapshot</code> underneath, which is how btrfs and LVM snapshots both work.",
          "btrfs subvolume snapshots have no size knob because there is nothing to size — <code>btrfs subvolume snapshot -r / /snap/root-pre</code> is a metadata write, and the CoW cost is charged to the source subvolume. The standard recipe is a read-only snapshot in a separate subvolume plus <code>btrfs send | zstd</code> piped off-box, because that is the step that makes it a backup. Subvolume snapshots share the same pool, so they share the same fate.",
          "ZFS snapshots are the most capable: <code>zfs snapshot tank/root@pre</code>, then <code>zfs send -i tank/root@pre tank/root@post</code> for an incremental replication. A snapshot is read-only and cannot be corrupted by an accidental <code>rm</code>, which is a real advantage over btrfs if you are not disciplined about <code>-r</code>.",
          "The reason none of this is a backup is identical in every case: <strong>the snapshot and the original live on the same physical medium and are managed by the same credentials</strong>. A deleted file is still deleted in every snapshot. A ransomware process with write access to the filesystem creates its own snapshots and deletes yours. A provider that loses a volume loses every snapshot in it. A snapshot is a rewind button for <em>your own mistakes and failed updates</em> — a narrow and very valuable category — and nothing else. Send it somewhere else, or it is decoration."
        ]
      },
      {
        type: "table",
        cols: ["", "LVM snapshot", "btrfs subvolume", "ZFS snapshot"],
        rows: [
          ["Create cost", "Metadata write, instant", "Metadata write, instant", "Metadata write, instant"],
          ["CoW overhead lands on", "The snapshot volume — must be sized", "The source subvolume's chunks", "The pool; <code>zpool iostat</code> shows the write amplification"],
          ["Deletion safety", "Writable by default unless you remount <code>ro</code>", "Read-only if you pass <code>-r</code>", "Always read-only"],
          ["Invalidation mode", "Runs out of snapshot volume; all dependent LVs become unusable", "Out of space in the pool; subvolume becomes bad-corrupted", "Out of pool space; snapshot is destroyed"],
          ["Off-box copy", "Mount <code>ro</code>, <code>rsync</code>", "<code>btrfs send | zstd</code>, <code>btrfs receive</code>", "<code>zfs send -i</code>, incremental and native"],
          ["Protects against a failed <code>apt upgrade</code>", "Yes", "Yes", "Yes"],
          ["Protects against <code>rm -rf</code>", "<strong>No</strong> — unless it ran before the snapshot was taken", "<strong>No</strong> — same", "<strong>No</strong> — same"],
          ["Protects against fire, theft, provider loss", "<strong>No</strong>", "<strong>No</strong>", "<strong>No</strong> — unless you <code>zfs send</code> off the box"]
        ]
      },
      {
        type: "callout",
        kind: "boss",
        title: "The one thing to take from this chapter",
        text: "Storage debugging is layer isolation, not cleverness. <code>lsblk</code> answers 'do I have the device', <code>blkid</code> answers 'what filesystem is on it', <code>findmnt</code> answers 'what is mounted where', <code>df</code> plus <code>du</code> plus <code>lsof +L1</code> answer 'where did the space go'. Run them in that order and the answer is in front of you. Everything else in this chapter — LVM, RAID, btrfs, ZFS, fstab, fsck, iostat — is a layer you can now reason about separately instead of treating 'the disk' as one thing that is either fine or broken."
      },
      {
        type: "prose",
        h: "Applying it to a 19 GB VPS",
        p: [
          "The reference box is small enough that the abstraction pays for itself. There is no LVM, no RAID, one ext4 root on <code>/dev/vda1</code>, and a journald cap doing exactly its job — which means every disk-full event there is one of four things and only four things: <code>rsync</code> wrote a new backup tree, a log grew without a rotation, Docker's overlay2 accumulated layers, or something opened a file and deleted it. That is a list you can check in ninety seconds with <code>df -hT</code>, <code>sudo lsof +L1</code>, <code>du -x --max-depth=1 /var</code> and <code>docker system df</code>.",
          "And that is the shape of the fix. Sixteen unpruned docroot backups in <code>/var/www/html</code> is ~374&nbsp;MB of a 19&nbsp;GB disk — the single largest thing on the box, and it is growing by one full copy per deploy. A retention policy is a storage fix. On a 2&nbsp;GB machine with 24% of the disk used, that kind of arithmetic is not housekeeping, it is the difference between a deploy that always succeeds and a deploy that eventually takes the site down."
        ]
      }
    ],
    takeaways: [
      "A byte passes through four layers — block device, partition, filesystem, mountpoint — each with its own failure mode, and each reports success upward independently. Storage debugging means finding the layer where the disagreement is, then reading the data out of that layer.",
      "Partition suffixes are a disambiguation rule, not a convention you can guess: /dev/sda1 and /dev/vda1 are letter-ended parents, /dev/nvme0n1p1 needs the 'p' because the parent already ends in a digit.",
      "Never put /dev/sda1 in fstab. Use UUID= from blkid. Discovery order changes between boots, and a wrong mount at boot means emergency.target, which on a Tailscale-only VPS is a box you cannot reach.",
      "ext4 shrinks unmounted; XFS cannot shrink at all, in any kernel, ever. xfs_growfs takes the mountpoint, not the device. Design volumes so that shrinking is never a thing you will need.",
      "RAID is availability, not backup. It protects against a disk dying and against nothing else — a deleted file is deleted on every member within seconds.",
      "Swap does not fix an OOM. It converts a fast, diagnosable SIGKILL into an undiagnosable stall. Watch vmstat's si and so columns and free -h's available number, not free.",
      "tmpfs pages are charged to cgroup memory limits, so a container with an un-sized /dev/shm gets killed in a way that looks nothing like an OOM — and POSIX shared memory fills at 64 MB by default in Docker, producing Bus error (SIGBUS), not ENOSPC.",
      "ENOSPC has four causes — bytes, inodes, deleted-but-open files, and un-capped growth. df -i, lsof +L1, du -x and journalctl --disk-usage each answer exactly one of them, and df alone answers none of them precisely.",
      "iostat's %util saturates at queue depth 1 and does not mean the device is busy. Use aqu-sz and await together: rising queue with rising latency is a saturated device, which is on a VPS a provider cap rather than your hardware.",
      "A snapshot is a rewind button for your own mistakes, not a backup. LVM, btrfs and ZFS all make snapshots nearly free; none of them survives a deleted file, ransomware, or the provider losing the volume, because the snapshot is in the same place."
    ],
    glossary: {
      "Block device": "A device the kernel addresses in fixed-size sectors (512 bytes on virtio), with a request queue and a driver. Filesystems sit on top of it; it knows nothing about files.",
      "Partition": "A range of sectors described by a partition table. It holds no data of its own and exists only so one device can carry several filesystems.",
      "GPT": "GUID Partition Table: an EFI partition scheme with 128 entries, 128-bit UUIDs, 1 MiB alignment defaults, a CRC32, and a full backup copy in the last 33 sectors.",
      "Protective MBR": "The single type-0xEE entry written at LBA 0 on a GPT disk so that pre-GPT tools refuse to write an MBR table over the real one.",
      "LVM": "Logical Volume Manager: pools block devices into physical volumes and volume groups, then hands out logical volumes, so a filesystem can be resized, snapshotted or moved while mounted.",
      "Extent": "The fixed-size (4 MiB default) chunk of a volume group's space that gets allocated to a logical volume. The size is fixed at pvcreate time.",
      "device-mapper": "The kernel dm target layer that presents stacked block devices as /dev/mapper/*. LVM, cryptsetup, thin provisioning and multipath all sit on it.",
      "RAID": "Redundant array of independent disks: striping and/or mirroring across several block devices to survive disk failure. Availability, not backup.",
      "CoW": "Copy-on-write: writing to new blocks and atomically relinking metadata, which is what makes btrfs and ZFS snapshots instant and metadata consistent.",
      "tmpfs": "A filesystem backed by RAM rather than disk, accounted as memory. Zero I/O, nothing survives a reboot, and its pages count against cgroup memory limits.",
      "fstab": "/etc/fstab: six fields per line (source, mountpoint, type, options, dump, fsck order) from which systemd-fstab-generator creates one .mount unit per entry.",
      "nofail": "An fstab option telling systemd that a failed mount should not drop the machine into emergency.target. The directory will simply be empty, which is its own hazard.",
      "ENOSPC": "The 'no space left on device' errno. On modern filesystems it covers both exhausted blocks and exhausted inodes, so df -i must be checked too.",
      "Deleted but open": "A file unlinked from the directory but still referenced by an open descriptor. Its blocks stay allocated until the last reference closes, which df reports as used and du cannot find.",
      "fsck": "A dispatcher that runs the filesystem-specific checker (fsck.ext4, fsck.xfs, fsck.btrfs) according to the superblock. It must never run on a mounted writable filesystem.",
      "Queue depth": "How many I/O requests a device can have in flight at once. Throughput approaches IOPS = queue_depth / latency, and latency degrades once the queue is full.",
      "%util": "The fraction of time a block device had at least one request in flight. It saturates at queue depth 1, so 100% %util does not mean the device is at its limit."
    }
  });
})();