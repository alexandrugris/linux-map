/* ch05 — The filesystem tree and how it is faked */
(function () {
  LX.push({
    id: "filesystem",
    title: "The filesystem tree and how it is faked",
    tagline: "One namespace grafted together out of many filesystems, most of which are never stored anywhere at all.",
    sections: [
      {
        type: "prose",
        h: "There is no directory called /",
        p: [
          "Start from the one thing everybody gets wrong: <code>/</code> is not a folder. It is not stored at sector zero, it is not in any partition table, and it does not exist until the kernel mounts something. <code>/</code> is the dentry at the top of the <strong>root filesystem's superblock</strong> — the dentry every absolute path is resolved against. Mount a namespace away from it and the tree simply stops existing for anything inside that namespace.",
          "Everything else in <code>/</code> is a graft. Mounting a filesystem takes a directory that already exists in the tree — the <em>mount point</em> — and splices the mounted filesystem's root dentry over it. From that instant the kernel considers the mount point to have two parents: the directory it still is, and the new superblock's root. Path resolution cannot tell them apart. <code>stat /mnt</code> reports the mounted filesystem's inode, never the empty directory that was underneath.",
          "Which means a machine with one 19 GB disk and 2 GB of RAM has far more filesystems than it has disks. On this Ubuntu 18.04 VPS, <code>findmnt</code> lists over twenty: ext4 on the root device, tmpfs on <code>/run</code>, <code>/run/lock</code> and <code>/dev/shm</code>, procfs on <code>/proc</code>, sysfs on <code>/sys</code>, the cgroup and cgroup2 pseudo-filesystems, devpts on <code>/dev/pts</code>, securityfs under <code>/sys/kernel/security</code>, mqueue on <code>/dev/mqueue</code>, plus whatever bind mounts and systemd hardening views you have added. <code>df -hT</code> shows types; <code>/proc/self/mountinfo</code> is the kernel's own view, per namespace, with every option string intact.",
          "The practical consequence: <strong>the tree is a namespace, not storage</strong>. Two paths that look like neighbours can sit on different devices with different ownership, different semantics and different failure modes. <code>/etc/passwd</code> and <code>/etc/hosts</code> on the root filesystem are ordinary files; inside a container the same two strings are overlayfs synthetic dentries whose inode numbers were invented at lookup time. Path-based reasoning breaks exactly where the bugs live — at mount boundaries."
        ]
      },
      {
        type: "diagram",
        h: "The tree is a stack of grafts, not a set of folders",
        caption: "One root dentry at the top; every subtree below it is either read off a block device or computed by the kernel while you are reading it. Only the left-hand group occupies disk. This is the single picture to keep: a mount is a splice, and the namespace is the result of all the splices.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Root dentry grafted onto ext4 on disk on the left and onto procfs, sysfs, devtmpfs and tmpfs on the right">
  <!-- root -->
  <rect class="box-a" x="400" y="24" width="300" height="66" rx="10"/>
  <text class="t-accent" x="550" y="52" font-size="17" text-anchor="middle">/  —  the root dentry</text>
  <text class="t-xs" x="550" y="74" text-anchor="middle">lives inside the root fs superblock, not on the disk</text>

  <path class="ln-a" d="M550,90 L550,118" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln" d="M116,118 L984,118"/>
  <path class="ln" d="M116,118 L116,152" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M309,118 L309,152" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M503,118 L503,152" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M697,118 L697,152" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M891,118 L891,152" marker-end="url(#lm-arrow)"/>

  <rect class="box" x="61" y="152" width="110" height="52" rx="8"/>
  <text class="t-sm" x="116" y="184" text-anchor="middle">/usr</text>
  <rect class="box" x="255" y="152" width="110" height="52" rx="8"/>
  <text class="t-sm" x="310" y="184" text-anchor="middle">/var</text>
  <rect class="box" x="449" y="152" width="110" height="52" rx="8"/>
  <text class="t-sm" x="504" y="184" text-anchor="middle">/home</text>
  <rect class="box" x="643" y="152" width="110" height="52" rx="8"/>
  <text class="t-sm" x="698" y="184" text-anchor="middle">/opt</text>

  <rect class="box-v" x="836" y="152" width="110" height="52" rx="8"/>
  <text class="t-sm" x="891" y="184" text-anchor="middle">/proc</text>
  <rect class="box-v" x="837" y="216" width="110" height="52" rx="8"/>
  <text class="t-sm" x="892" y="248" text-anchor="middle">/sys</text>
  <rect class="box-v" x="837" y="280" width="110" height="52" rx="8"/>
  <text class="t-sm" x="892" y="312" text-anchor="middle">/dev</text>
  <rect class="box-v" x="837" y="344" width="110" height="52" rx="8"/>
  <text class="t-sm" x="892" y="376" text-anchor="middle">/run</text>

  <!-- storage side -->
  <rect class="box-ok" x="45" y="222" width="482" height="122" rx="12"/>
  <text class="t-ok" x="65" y="250" font-size="16">ext4 — one block device, one superblock</text>
  <text class="t-xs" x="65" y="272">/dev/vda1, 19 GB total on this box, ~17 GB used</text>
  <text class="t-xs" x="65" y="292">inode table + block bitmaps + journal, all real bytes</text>
  <text class="t-xs" x="65" y="312">the journal (jbd2) is what makes crash-consistency possible</text>
  <text class="t-xs" x="65" y="332">losing it costs you the last few seconds of writes, nothing more</text>

  <!-- kernel side -->
  <rect class="box-v" x="541" y="222" width="514" height="196" rx="12"/>
  <text class="t-violet" x="561" y="250" font-size="16">synthesised while you read it — zero bytes on disk</text>
  <text class="t-xs" x="561" y="274">procfs   read() walks the task_struct list and formats a string</text>
  <text class="t-xs" x="561" y="296">sysfs    read() walks the kobject tree; every attribute is a live</text>
  <text class="t-xs" x="561" y="314">         kernel variable, so /sys is the control panel</text>
  <text class="t-xs" x="561" y="338">devtmpfs  node created by the kernel the moment a device driver</text>
  <text class="t-xs" x="561" y="356">         calls device_add(); udev only decorates it</text>
  <text class="t-xs" x="561" y="380">tmpfs    anonymous pages the kernel is willing to hand back</text>
  <text class="t-xs" x="561" y="400">         under pressure — /run dies with the boot it belongs to</text>

  <path class="ln-dash dash" d="M541,300 L527,300" />
  <line class="ln dash" x1="527" y1="240" x2="527" y2="410" stroke-width="2"/>
  <text class="t-xs" x="527" y="426" text-anchor="middle">this edge is a lie: same path, different filesystem</text>

  <rect class="box-w" x="45" y="450" width="1010" height="86" rx="10"/>
  <text class="t-warn" x="65" y="478" font-size="15">df -hT  →  one line per MOUNTED FILESYSTEM, not per disk</text>
  <text class="t-xs" x="65" y="500">findmnt  →  the mount tree with the source, target, fstype and full option string</text>
  <text class="t-xs" x="65" y="520">/proc/self/mountinfo → the same thing, unfiltered, plus per-mount ID/pair/root for namespaces</text>

  <text class="t-dim" x="45" y="574" font-size="14">Consequence: /etc/nginx and /var/www/html can be on different devices with</text>
  <text class="t-dim" x="45" y="594" font-size="14">different owners, different options and different failure modes. Cross a mount and your assumptions stop holding.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "Superblock, inode, dentry, file: four objects, four lifetimes",
        p: [
          "The VFS keeps four separate kernel objects and they have genuinely different lifetimes. Confusing them explains most of the strange behaviour you will meet.",
          "<strong>superblock</strong> (<code>struct super_block</code>) — one per mounted filesystem, loaded at mount time from the on-disk superblock, cached in memory, written back on unmount. On Linux the on-disk superblock magic for ext4/xfs/btrfs is <code>0xEF53</code>; the kernel uses it to decide which driver to try. <code>/proc/filesystems</code> lists what is compiled in or currently loaded; <code>/proc/mounts</code> lists what is actually mounted.",
          "<strong>inode</strong> (<code>struct inode</code>) — the file itself: mode, uid/gid, timestamps, size, block map, link count. The on-disk inode is a fixed-size record in the inode table, and its number <em>is</em> the file's identity for as long as it lives. Paths are not identity. A file has exactly one inode per filesystem, no matter how many names point at it.",
          "<strong>dentry</strong> (<code>struct dentry</code>) — a name and a pointer to its parent, cached to make lookup fast. dentries are pure memory; they are created on lookup, evicted under memory pressure, and can be <em>negative</em> (a cached “this name does not exist here”, which is why a program that keeps <code>stat</code>-ing a missing file in a loop is cheap, and why creating the file afterwards may not wake it up).",
          "<strong>file</strong> (<code>struct file</code>) — an <em>open instance</em>. It holds the inode pointer, the current file offset, the mode flags, the path it was opened through and its <code>struct file_operations</code>. This is the object that makes <code>/proc/PID/fd/3</code> meaningful and it is the object counted against the file limits. Ten thousand <code>open()</code> calls on one file are ten thousand <code>struct file</code> objects pointing at one inode.",
          "Resolution of <code>/var/log/nginx/access.log</code> is therefore: for each component, look up a dentry under the current one, and at the final component install an <code>struct file</code> over the resulting inode. The kernel function is <code>link_path_walk</code> / <code>filename_lookup</code>, and every <code>open()</code>, <code>stat()</code>, <code>chdir()</code> and <code>execve()</code> pays it."
        ]
      },
      {
        type: "diagram",
        h: "Path resolution: from a string to an open file",
        caption: "The left column is what you type. The middle is pure kernel memory cache. The right is what is actually on the disk. The bottom strip is the part people forget: the page cache and the address_space sit between the open file and the block layer, which is why a read can succeed even when the device has not moved.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="Path string resolved through a dentry chain to an inode and then to an open file object and file descriptor">
  <rect class="box-a" x="36" y="30" width="246" height="70" rx="10"/>
  <text class="t-accent" x="159" y="58" font-size="16" text-anchor="middle">"/var/log/nginx/access.log"</text>
  <text class="t-xs" x="159" y="80" text-anchor="middle">just bytes in user memory</text>

  <path class="ln-a" d="M282,65 L318,65" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="322" y="30" width="272" height="242" rx="12"/>
  <text class="t-violet" x="340" y="56" font-size="16">dentry cache — RAM only</text>
  <text class="t-xs" x="340" y="74">one lookup per component, cached until memory pressure</text>

  <rect class="box" x="340" y="88" width="236" height="34" rx="6"/>
  <text class="t-sm" x="352" y="111">dentry  "/"        → root fs superblock</text>
  <rect class="box" x="340" y="126" width="236" height="34" rx="6"/>
  <text class="t-sm" x="352" y="149">dentry  "var"      → next inode</text>
  <rect class="box" x="340" y="164" width="236" height="34" rx="6"/>
  <text class="t-sm" x="352" y="187">dentry  "log"      → next inode</text>
  <rect class="box" x="340" y="202" width="236" height="34" rx="6"/>
  <text class="t-sm" x="352" y="225">dentry  "nginx"    → next inode</text>
  <rect class="box-w" x="340" y="240" width="236" height="30" rx="6"/>
  <text class="t-sm" x="352" y="260">dentry  "access.log" → FINAL, resolved</text>

  <path class="ln" d="M594,120 L634,120" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M594,196 L634,196" marker-end="url(#lm-arrow)"/>
  <text class="t-dim" x="612" y="112" font-size="13" text-anchor="middle">mounts</text>
  <text class="t-dim" x="612" y="168" font-size="13" text-anchor="middle">checked</text>

  <rect class="box-ok" x="638" y="30" width="222" height="176" rx="12"/>
  <text class="t-ok" x="656" y="56" font-size="16">inode — identity</text>
  <text class="t-xs" x="656" y="80">mode 0644  uid 33 www-data</text>
  <text class="t-xs" x="656" y="100">nlink 1   size 4 182 003</text>
  <text class="t-xs" x="656" y="120">mtime, ctime, atime</text>
  <text class="t-xs" x="656" y="140">extent tree = where the blocks are</text>
  <text class="t-xs" x="656" y="162">i_rdev: character/block special</text>
  <text class="t-xs" x="656" y="184">survives rename; not the name</text>

  <rect class="box-p" x="874" y="30" width="192" height="176" rx="12"/>
  <text class="t-bad" x="892" y="56" font-size="16">on disk (ext4)</text>
  <text class="t-xs" x="892" y="82">inode 481925</text>
  <text class="t-xs" x="892" y="104">in the inode table</text>
  <text class="t-xs" x="892" y="126">data in extents,</text>
  <text class="t-xs" x="892" y="146">logged in jbd2</text>
  <text class="t-xs" x="892" y="168">1 inode = 256 bytes,</text>
  <text class="t-xs" x="892" y="188">32-bit inode number</text>

  <path class="ln-a" d="M749,206 L749,244" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="765" y="232" font-size="14">open() installs a struct file over this inode</text>

  <rect class="box-a" x="622" y="248" width="252" height="140" rx="10"/>
  <text class="t-accent" x="642" y="274" font-size="16">struct file — open instance</text>
  <text class="t-xs" x="642" y="298">f_pos = 0        (this one's offset)</text>
  <text class="t-xs" x="642" y="318">f_flags = O_RDONLY|O_LARGEFILE</text>
  <text class="t-xs" x="642" y="338">f_op → file_operations table</text>
  <text class="t-xs" x="642" y="358">f_mapping → address_space → page cache</text>
  <text class="t-xs" x="642" y="378">one of these per open(); counted against limits</text>

  <rect class="box-w" x="888" y="248" width="178" height="140" rx="10"/>
  <text class="t-warn" x="906" y="274" font-size="15">fd table</text>
  <text class="t-xs" x="906" y="300">fd 0,1,2 inherited</text>
  <text class="t-xs" x="906" y="320">fd 3 → access.log</text>
  <text class="t-xs" x="906" y="340">fd 4 → the old one</text>
  <text class="t-xs" x="906" y="360">from the previous log</text>
  <text class="t-xs" x="906" y="380">file, still open</text>

  <path class="ln-ok" d="M874,318 L878,318" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box" x="36" y="420" width="1030" height="146" rx="12"/>
  <text class="t-sm" x="56" y="448" font-size="15">the layers you never see in a syscall</text>
  <text class="t-xs" x="56" y="474">syscall open() → VFS namei → inode → address_space (page cache, cache the full file) → ext4 ext4_file_read_iter</text>
  <text class="t-xs" x="56" y="496">a cache hit costs a memcpy. A miss goes ext4_readpage → submit_bio → device mapper / virtio_blk → /dev/vda1.</text>
  <text class="t-xs" x="56" y="518">write() with O_DIRECT bypasses the page cache on purpose; write() without it does not reach the device until the dirty</text>
  <text class="t-xs" x="56" y="540">pages age out, which is why <tspan class="t-mono">sync</tspan> and <tspan class="t-mono">fsync</tspan> are different words and only the second one is a guarantee.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "Prove that a name and an inode are different things, and look at what the filesystem thinks it is holding",
        code: `$ ls -i /etc/passwd
481925  -rw-r--r-- 1 root root  1873 Aug 21 09:14 /etc/passwd

$ stat /etc/passwd
  File: /etc/passwd
  Size: 1873        Blocks: 8          IO Block: 4096   regular file
Device: 253,1       Inode: 481925      Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-08-21 09:14:31.000000000 +0300
Modify: 2026-08-21 09:14:31.000000000 +0300
Change: 2026-08-21 09:14:31.000000000 +0300
 Birth: 2026-02-03 11:02:07.512934000 +0200

$ ls -i /etc/passwd /etc/shadow
481925 /etc/passwd     481926 /etc/shadow
#      ^ different inodes, same directory, same filesystem

# ask the driver directly, bypassing the page cache and the VFS guesswork
$ debugfs -R "stat /etc/passwd" /dev/vda1 2>/dev/null | head -6
Inode: 481925   Type: Regular   Mode:  0644   Flags: 0x80000
User: 0   Group: 0
Size: 1873   Blocks: 8   IO Block: 4096

# what is actually mounted where
$ findmnt -t ext4,tmpfs,proc,sysfs,devpts -o TARGET,SOURCE,FSTYPE,OPTIONS
TARGET      SOURCE                  FSTYPE   OPTIONS
/           /dev/vda1               ext4     rw,relatime,errors=remount-ro
/var/log/journal /dev/vda1          ext4     rw,relatime,errors=remount-ro,data=ordered
/run        tmpfs                  tmpfs    rw,nosuid,nodev,mode=755
/dev/shm    tmpfs                  tmpfs    rw,nosuid,nodev,noexec
/proc       proc                   proc     rw,nosuid,nodev,noexec,relatime
/sys        sysfs                  sysfs    rw,nosuid,nodev,noexec,relatime`
      },
      {
        type: "callout",
        kind: "fact",
        title: "Inode numbers are only meaningful inside one filesystem",
        text: "Compare inode numbers across mounts and you are comparing meaningless integers. <code>/etc/passwd</code> and <code>/proc/self/exe</code> both report an inode; only one of them has a backing inode table behind it. Worse, on tmpfs, overlayfs and most network filesystems, inode numbers are <strong>synthesised per lookup</strong> and can differ between two stats of the same live file. Never key a cache, a database or a dedup tool on inode numbers across mounts."
      },
      {
        type: "prose",
        h: "Hardlinks and symlinks: same string, different physics",
        p: [
          "<code>ln /a/b /c/d</code> and <code>ln -s /a/b /c/d</code> produce two names that both resolve. Nothing else about them is alike, and the difference is the source of a family of bugs that every operator meets eventually.",
          "A <strong>hardlink</strong> is a second directory entry in some inode's <code>nlink</code> count. There is one inode, one data, and N names. Unlinking any one name decrements <code>nlink</code>; the data dies when <code>nlink</code> reaches zero <em>and</em> the last file descriptor closes. There is no such thing as “the original” — every link is equally original. A hardlink cannot cross a filesystem, because the two dentries would have to point into the same superblock's inode table, and inode numbers are only unique within a superblock.",
          "A <strong>symlink</strong> is a file whose <em>contents</em> are a path string, with the mode bits <code>lrwxrwxrwx</code> and an inode like any other. Resolution is a second lookup, performed by the kernel after the first one lands on the symlink inode. It is relative unless the stored string starts with <code>/</code>, and it is resolved against the <strong>directory containing the symlink</strong>, not the caller's working directory — the single most common source of dangling symlinks when a tree is moved or a package upgrades.",
          "Now the operational consequences, which are the real content of this section."
        ],
        ul: [
          "<strong>Why a hardlinked log cannot be rotated the way people expect.</strong> <code>logrotate</code> by default uses <code>create</code>: rename <code>access.log</code> to <code>access.log.1</code> and create a fresh empty <code>access.log</code>. If the old inode has another name — <code>access.log.1</code> <em>and</em> the hardlink you made to <code>/var/log/current</code> — then both names keep pointing at the same inode. The <em>new</em> file you just created is a different inode, and every process holding the old fd keeps writing to the renamed file. The classic symptom: the site works, the new log is empty, and the old file is still growing after rotation. It is not a logrotate bug; it is inode identity working as designed. The fixes are <code>copytruncate</code> (copy then truncate in place — briefly lossy, duplicates the inode's content) or never hardlinking logs in the first place.",
          "<strong>Why editors break links.</strong> A modern editor does not write through the existing inode. It writes a new file next to the target, then <code>rename(2)</code>s it over the old name — atomic replacement. For a symlink, <code>rename</code> replaces the <em>symlink</em>, and the target is untouched: the link is gone, the file remains. For a hardlink, <code>rename</code> replaces one of the names; the other names keep the original inode, so your edit appears to vanish from the second name. Vim has knobs for this — <code>:set backupcopy=yes|no|auto</code> and <code>:set backup</code> — and <code>auto</code> means “break the link to be safe”, which is why the same command behaves differently on different files. Emacs uses <code>write-region</code> plus <code>rename-file</code> for the same reason; <code>save-buffer</code> with <code>backup-buffer-copying</code> changes the behaviour.",
          "<strong>Why <code>mv</code> across filesystems is a copy.</strong> <code>rename(2)</code> cannot cross a superblock, so when <code>mv</code> sees two different devices it opens the source, copies the bytes, and unlinks the original — losing the atomicity and the inode number. This bites deploy scripts: an <code>mv</code> that was instant on one run and slow on another was probably local the first time and crossing into <code>/var/www/html</code> (a separate mount) the second.",
          "<strong>Why <code>tar</code> and <code>rsync</code> care.</strong> A tarball with two entries of the same inode is a hardlink pair and is extracted as one. An rsync transfer that does not preserve hardlinks turns them into two full copies, silently doubling the data. <code>rsync -H</code> is what preserves them."
        ]
      },
      {
        type: "diagram",
        h: "One inode, two names — versus a file that points at a name",
        caption: "Left: after <code>ln</code> there is exactly one inode with <code>nlink = 2</code>. Rename one name and the other still sees the old bytes, because the inode did not move. Right: a symlink is a small file whose content is a path string; it has its own inode, its own mode, its own owner, and it can dangle.",
        svg: `
<svg viewBox="0 0 1100 520" role="img" aria-label="Hardlink sharing one inode with two directory names versus a symlink whose content is a path string">
  <text class="t-title" x="40" y="36" font-size="17">hardlink — ln target link</text>
  <text class="t-xs" x="40" y="56">one inode, nlink = 2, two names in two directories</text>

  <rect class="box" x="40" y="76" width="200" height="46" rx="7"/>
  <text class="t-sm" x="56" y="104">/var/log/nginx/access.log</text>
  <rect class="box" x="40" y="146" width="200" height="46" rx="7"/>
  <text class="t-sm" x="56" y="174">/var/log/current</text>

  <path class="ln-a" d="M240,99 L330,99" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M240,169 L330,169" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="334" y="76" width="212" height="116" rx="10"/>
  <text class="t-ok" x="352" y="104" font-size="15">inode 481925</text>
  <text class="t-xs" x="352" y="126">nlink = 2</text>
  <text class="t-xs" x="352" y="146">the bytes live here</text>
  <text class="t-xs" x="352" y="166">and nowhere else</text>
  <text class="t-xs" x="352" y="184">rename() moves names, not data</text>

  <rect class="box-b" x="40" y="216" width="506" height="84" rx="10"/>
  <text class="t-bad" x="58" y="242" font-size="15">logrotate does: mv access.log access.log.1 ; touch access.log</text>
  <text class="t-xs" x="58" y="264">inode 481925 is now reached by BOTH names. The fresh empty access.log is a brand-new inode.</text>
  <text class="t-xs" x="58" y="284">nginx workers still hold fd → 481925 → still writing to the renamed file. New requests log nothing.</text>

  <line class="ln dash" x1="575" y1="40" x2="575" y2="470" stroke-width="2"/>

  <text class="t-title" x="610" y="36" font-size="17">symlink — ln -s target link</text>
  <text class="t-xs" x="610" y="56">a file whose content is a path; a second lookup follows</text>

  <rect class="box-a" x="610" y="76" width="200" height="46" rx="7"/>
  <text class="t-sm" x="626" y="104">/var/www/html/current</text>

  <path class="ln-a" d="M810,99 L872,99" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="876" y="76" width="184" height="46" rx="7"/>
  <text class="t-xs" x="890" y="96">inode 481930</text>
  <text class="t-xs" x="890" y="114">lrwxrwxrwx · 18 bytes</text>

  <rect class="box-a" x="876" y="136" width="184" height="72" rx="7"/>
  <text class="t-xs" x="890" y="158">content:</text>
  <text class="t-sm" x="890" y="178">"/srv/sites/4.2"</text>
  <text class="t-xs" x="890" y="198">resolved against the</text>
  <text class="t-xs" x="890" y="214">symlink's own directory</text>

  <path class="ln-ok" d="M968,212 L968,250" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-ok" x="790" y="254" width="270" height="52" rx="7"/>
  <text class="t-sm" x="806" y="284">inode 481925 — the real file</text>

  <rect class="box-b" x="610" y="330" width="450" height="106" rx="10"/>
  <text class="t-bad" x="628" y="356" font-size="15">what editing it does</text>
  <text class="t-xs" x="628" y="378">the editor writes current.new and rename(2)s it over current —</text>
  <text class="t-xs" x="628" y="396">the symlink inode is replaced. /srv/sites/4.2 is never touched.</text>
  <text class="t-xs" x="628" y="420">the link is gone and the target still holds the old bytes: "my edit disappeared"</text>

  <rect class="box" x="610" y="450" width="450" height="54" rx="9"/>
  <text class="t-xs" x="628" y="472">ln -s relative targets break when a tree moves; absolute targets break when</text>
  <text class="t-xs" x="628" y="492">the machine is rebuilt. Neither form survives an rsync that skips symlinks.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "The file descriptor table, and why 0/1/2 survive exec",
        p: [
          "Every process has a small, flat, per-process table of integers pointing at <code>struct file</code> objects. It starts at 0 and grows by three entries — 0, 1, 2 — for stdin, stdout, stderr. Because the table is flat and unnamed, the numbers mean nothing except by convention. <code>fd 3</code> in <code>nginx</code> and <code>fd 3</code> in <code>sshd</code> are unrelated.",
          "<code>execve(2)</code> does not clear the table. It tears down the old address space, loads the new binary, and <strong>reinstalls the surviving descriptors into the new process image</strong>. That is the entire mechanism behind the pipe, the shell redirection and <code>systemd</code>'s <code>StandardOutput=</code>. <code>ssh host 'ls &gt; /tmp/x'</code> works because sshd forked, dup2'd the pipe onto descriptor 1, and exec'd a shell that inherited it. Anything you close before the exec closes the pipe for the child too — the classic “ssh command hangs forever” is the pipe write end held open by a stray background process, not a network problem.",
          "There is one filter on that inheritance: <code>FD_CLOEXEC</code>. Any descriptor opened with <code>O_CLOEXEC</code> (and a great many are, deliberately) is closed by the kernel as part of the exec. It is how libraries guarantee they never leak a socket or a key into a child. Note the asymmetry that bites people: <code>dup2(fd, 1)</code> <em>clears</em> <code>FD_CLOEXEC</code> on the new descriptor, because the whole point of <code>dup2</code> before <code>exec</code> is to hand the descriptor over.",
          "<code>/proc/PID/fd</code> is a directory synthesised by procfs whose entries are symlinks to <code>/dev/pts/0</code>, <code>/var/log/nginx/error.log</code>, <code>socket:[12345]</code>, <code>pipe:[6789]</code>, <code>anon_inode:[eventpoll]</code>. Reading the directory gives you the live table with no cooperation from the process — which is why <code>lsof</code> and <code>ss</code> can be bolted onto a machine from the outside. The companion files <code>/proc/PID/fdinfo/N</code> carry the flags, the file offset and the <code>pos</code>/<code>flags</code> bits; <code>/proc/PID/fdinfo/N/epoll</code> tells you which descriptors that <code>epoll</code> instance is watching."
        ]
      },
      {
        type: "diagram",
        h: "Descriptor inheritance across exec, and where O_CLOEXEC bites",
        caption: "The descriptor table belongs to the process, not to the binary. <code>execve</code> replaces the address space and re-inserts the table; descriptors with <code>FD_CLOEXEC</code> are the exception. systemd sets that flag on every socket it opens and then explicitly clears it for the handful a unit is meant to pass on — that is what <code>StandardInput=null</code> versus inheriting really means.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Descriptor table before exec, across exec, and after, showing O_CLOEXEC descriptors being closed">
  <text class="t-title" x="40" y="34" font-size="17">before exec — a shell in a session</text>

  <rect class="box" x="40" y="52" width="290" height="196" rx="10"/>
  <text class="t-xs" x="56" y="74">shell's fd table</text>
  <text class="t-sm" x="58" y="98">0  → /dev/pts/0</text>
  <text class="t-sm" x="58" y="120">1  → /dev/pts/0</text>
  <text class="t-sm" x="58" y="142">2  → /dev/pts/0</text>
  <text class="t-sm" x="58" y="164">3  → pipe:[67890]   CLOEXEC</text>
  <text class="t-sm" x="58" y="186">4  → /dev/null       CLOEXEC</text>
  <text class="t-sm" x="58" y="208">5  → socket:[1234]   CLOEXEC</text>
  <text class="t-xs" x="58" y="232">lsof -p $$ sees exactly this</text>

  <path class="ln-a" d="M330,150 L430,150" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="380" y="132" font-size="15" text-anchor="middle">execve(2)</text>
  <text class="t-xs" x="380" y="180" font-size="13" text-anchor="middle">address space is</text>
  <text class="t-xs" x="380" y="196" font-size="13" text-anchor="middle">replaced, table is not</text>

  <rect class="box-a" x="434" y="52" width="290" height="196" rx="10"/>
  <text class="t-xs" x="450" y="74">/usr/bin/systemctl — same table</text>
  <text class="t-sm" x="452" y="98">0  → /dev/pts/0      survived</text>
  <text class="t-sm" x="452" y="120">1  → /dev/pts/0      survived</text>
  <text class="t-sm" x="452" y="142">2  → /dev/pts/0      survived</text>
  <text class="t-dim" x="452" y="164">3  — closed by the kernel (CLOEXEC)</text>
  <text class="t-dim" x="452" y="186">4  — closed</text>
  <text class="t-dim" x="452" y="208">5  — closed</text>
  <text class="t-xs" x="452" y="232">and /proc/PID/fd now lists 0,1,2 only</text>

  <line class="ln dash" x1="40" y1="278" x2="1060" y2="278" stroke-width="2"/>

  <text class="t-title" x="40" y="312" font-size="17">what this buys you</text>

  <rect class="box-ok" x="40" y="332" width="330" height="196" rx="10"/>
  <text class="t-ok" x="58" y="358" font-size="15">pipelines</text>
  <text class="t-xs" x="58" y="382">ls -l | grep nginx | wc -l</text>
  <text class="t-xs" x="58" y="404">three execs, one pipe. Each fork dups the pipe</text>
  <text class="t-xs" x="58" y="422">write end onto fd 1 and the read end onto fd 0.</text>
  <text class="t-xs" x="58" y="444">The kernel does nothing clever: the userland</text>
  <text class="t-xs" x="58" y="462">arranged the descriptors, exec just kept them.</text>
  <text class="t-xs" x="58" y="488">The pipeline is a shell feature, not a kernel one.</text>
  <text class="t-xs" x="58" y="510">Only bash's coproc / named pipes give you the</text>
  <text class="t-xs" x="58" y="522">other direction.</text>

  <rect class="box-a" x="390" y="332" width="330" height="196" rx="10"/>
  <text class="t-accent" x="408" y="358" font-size="15">systemd StandardOutput=</text>
  <text class="t-xs" x="408" y="382">journal → socketpair, dup2'd to 1 and 2</text>
  <text class="t-xs" x="408" y="404">file:/var/log/x.log → the file, opened O_CLOEXEC,</text>
  <text class="t-xs" x="408" y="422">flag cleared, handed over</text>
  <text class="t-xs" x="408" y="444">null → /dev/null</text>
  <text class="t-xs" x="408" y="466">tty → the controlling terminal, or journal if none</text>
  <text class="t-xs" x="408" y="488">inherit → the unit's own 1/2, e.g. sshd's from sshd</text>
  <text class="t-xs" x="408" y="510">fd 3+ are NOT inherited unless the unit says so —</text>
  <text class="t-xs" x="408" y="522">systemd closes them. You cannot leak by accident.</text>

  <rect class="box-w" x="740" y="332" width="320" height="196" rx="10"/>
  <text class="t-warn" x="758" y="358" font-size="15">the failure modes</text>
  <text class="t-xs" x="758" y="382">ssh cmd '...' that never returns: something in</text>
  <text class="t-xs" x="758" y="400">the remote side still holds the pipe write end.</text>
  <text class="t-xs" x="758" y="424">nginx worker with fd leaks: count climbs until</text>
  <text class="t-xs" x="758" y="442">open() returns EMFILE.</text>
  <text class="t-xs" x="758" y="466">A binary that leaks a key or socket into a child</text>
  <text class="t-xs" x="758" y="484">process means your O_CLOEXEC discipline failed.</text>
  <text class="t-xs" x="758" y="508">strace -f -e trace=openat ./prog is how you</text>
  <text class="t-xs" x="758" y="522">catch it before production does.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "Too many open files: three different ceilings",
        p: [
          "“Too many open files” is two distinct kernel errors with two distinct causes, and telling them apart is most of the debugging.",
          '<strong>EMFILE</strong> — the <em>process</em> hit its own <code>RLIMIT_NOFILE</code>. This is the one you almost always mean. <code>open()</code> returns <code>-1 EMFILE</code>. nginx logs it as <code>open() "/var/log/nginx/access.log" failed (24: Too many open files)</code>. The limit is a per-process number of descriptors: soft and hard, inherited from the parent, raised only by <code>setrlimit</code> with privilege.',
          "<strong>ENFILE</strong> — the <em>system</em> ran out of file handles. <code>/proc/sys/fs/file-max</code> is the ceiling on how many <code>struct file</code> objects the kernel will allocate at once, system-wide. Ubuntu 18.04 ships systemd's <code>/usr/lib/sysctl.d/50-default.conf</code> which sets it to <code>1000000</code>; the historic kernel default of 10% of RAM is long gone. Hitting it means thousands of processes, not one.",
          "<strong>RLIMIT_NOFILE</strong> is itself bounded by <code>/proc/sys/fs/nr_open</code>, default <code>1048576</code> on every distro you will meet. You may set the hard limit to anything up to that; above it, <code>setrlimit</code> fails with <code>EPERM</code> even as root. That is the third ceiling and the reason the other two are reachable.",
          "Where the numbers actually come from, in order of precedence for a program started by systemd 237 on Ubuntu 18.04: the unit file's <code>LimitNOFILE=</code>, then the manager's default <code>DefaultLimitNOFILE</code> in <code>/etc/systemd/system.conf</code> (<code>1024:524288</code> on this release), then the compiled-in <code>DEFAULT_RLIMIT_NOFILE</code>. Login shells do not go through systemd: <code>pam_limits</code> applies <code>/etc/security/limits.conf</code> and its <code>/etc/security/limits.d/*.conf</code> snippets, which is why <code>ulimit -n</code> in your SSH session and <code>LimitNOFILE</code> on a unit are allowed to disagree. Hard limit is not 1024 in either case; 1024 is the soft value, and that is the number you trip over."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Find which of the three ceilings is actually biting, before you change anything",
        code: `# 1. what does this process currently believe?
$ cat /proc/$(pidof nginx | cut -d' ' -f1)/limits | grep -i "open files"
Max open files            1024                 524288                 files

# 2. where does that soft number come from? pid 1's, unless the unit overrode it
$ grep -r DefaultLimitNOFILE /etc/systemd/system.conf /lib/systemd/system.conf
#DefaultLimitNOFILE=1024:524288
$ systemctl show nginx.service -p LimitNOFILE
LimitNOFILE=1024 524288

# 3. is the process leaking descriptors, or just too small a limit?
$ ls /proc/$(pidof nginx | head -1)/fd | wc -l
# 1023 and not climbing -> limit is simply too low
# 1023, and the number of .log files on disk is 60 -> something is leaking an fd per file

# 4. system-wide handle exhaustion (ENFILE) looks like this:
$ cat /proc/sys/fs/file-max
1000000
$ cat /proc/sys/fs/nr_open
1048576

# 5. the fix, in the right place
$ systemctl edit nginx.service
[Service]
LimitNOFILE=16384
$ systemctl daemon-reload && systemctl restart nginx

# 6. for a login shell instead, via pam_limits — NOT via /etc/systemd/system.conf
$ printf '%s\\n' '* soft nofile 16384' '* hard nofile 16384' > /etc/security/limits.d/99-nofile.conf
$ ulimit -n
16384

# 7. nginx has its own ceiling, and it is the one people miss
$ nginx -T 2>/dev/null | grep worker_rlimit_nofile
worker_rlimit_nofile 65535;`
      },
      {
        type: "table",
        cols: ["Mechanism", "Scope", "Default here", "How you raise it", "Symptom when exceeded"],
        rows: [
          ["<code>RLIMIT_NOFILE</code> soft", "per process, inherited", "1024 (systemd 237, and pam_limits for login shells)", "<code>LimitNOFILE=</code> in the unit, or <code>/etc/security/limits.d/</code> for a shell", "<code>open()</code> → <code>EMFILE</code>"],
          ["<code>RLIMIT_NOFILE</code> hard", "per process, needs privilege to raise", "524288 via systemd; 1048576 via pam_limits on Ubuntu", "only root may raise it, and only to <code>nr_open</code>", "<code>setrlimit</code> → <code>EPERM</code>"],
          ["<code>/proc/sys/fs/nr_open</code>", "system-wide ceiling on the hard limit", "1048576", "<code>sysctl fs.nr_open</code>", "<code>EPERM</code> from a larger request"],
          ["<code>/proc/sys/fs/file-max</code>", "system-wide count of open <code>struct file</code>", "1000000, set by systemd's <code>50-default.conf</code>", "<code>sysctl fs.file-max</code>, or <code>/etc/sysctl.d/</code> to persist", "<code>open()</code> → <code>ENFILE</code>"],
          ["<code>nginx worker_rlimit_nofile</code>", "nginx worker processes only", "65535 in the packaged config", "edit the nginx config, not the unit", "<code>EMFILE</code> from inside nginx"],
          ["inotify / epoll instances", "per user, separate accounting", "<code>max_user_instances</code> 128, <code>max_user_watches</code> 8192-ish", "<code>/proc/sys/fs/inotify/*</code>", "<code>ENOSPC</code> from <code>inotify_init</code> or <code>epoll_create</code>"],
          ["NFS / network file handles", "server-side export limits", "varies", "server config", "<code>ESTALE</code> / <code>EIO</code>, which look like nothing to do with limits"]
        ]
      },
      {
        type: "prose",
        h: "Mounts, and every field of /etc/fstab",
        p: [
          "systemd does not read <code>/etc/fstab</code> the way SysVinit did. <code>systemd-fstab-generator</code> runs at every boot, converts each entry into a fully-specified <code>.mount</code> unit, and those units take part in normal dependency ordering. That single fact explains most of the surprising behaviour people attribute to fstab itself: you can <code>systemctl daemon-reload</code> after editing fstab, you can <code>systemctl status var-www-html.mount</code>, you can <code>systemctl mask</code> a mount, and a mount can have <code>Requires=</code> and <code>After=</code> like anything else.",
          "The unit name is the escaped path — <code>/var/www/html</code> becomes <code>var-www-html.mount</code>, with <code>/</code> becoming <code>-.mount</code> — so a filesystem that refuses to mount is visible as a failed unit in <code>systemctl --failed</code> rather than as silence."
        ]
      },
      {
        type: "table",
        cols: ["Field", "Meaning", "Details that matter"],
        rows: [
          ["1. device", "What to mount", "Prefer <code>UUID=…</code>. <code>/dev/sda1</code> is a naming convention assigned at boot by udev and can move between disks, USB buses and virtualisation layers. <code>LABEL=</code> is acceptable; <code>PARTUUID=</code> survives a reformat of the filesystem but not a repartition."],
          ["2. mount point", "Where in the namespace", "The directory must exist before mount runs. systemd creates it from the unit automatically, which is why you can write an fstab entry for a directory that does not exist yet."],
          ["3. type", "Filesystem driver", "<code>auto</code> reads the superblock magic (<code>0xEF53</code> for ext2/3/4, xfs, btrfs, jfs, reiserfs) — but never use it for the root filesystem; a wrong guess there is how a rescue takes an hour. <code>swap</code>, <code>none</code> for bind mounts."],
          ["4. options", "Everything", "<code>defaults</code> = <code>rw,suid,dev,exec,auto,nouser,async</code>. Then: <code>noatime</code> (Ubuntu 18.04 sets this on /), <code>relatime</code>, <code>errors=remount-ro</code>, <code>discard</code> or <code>ssd</code>, <code>commit=</code>, <code>barrier</code>, <code>x-systemd.*</code> below."],
          ["4a. nofail", "Do not wait for it, do not fail on it", "Turns <code>Requires=</code> into <code>Wants=</code>. Without it, a failing filesystem is a boot-time dependency failure, and anything that needs the mount never starts."],
          ["4b. _netdev", "The device needs the network first", "The generator adds <code>After=network.target</code> and <code>Wants=network.target</code>. Legacy <code>mount -a</code> used it to defer to <code>net</code> in the old rc ordering. It does not wait for <em>network-online</em> — for a real remote share use <code>x-systemd.requires=network-online.target</code> instead, or you will mount an empty directory."],
          ["4c. x-systemd.automount", "Mount on first access", "Creates <code>foo.mount</code> and <code>foo.automount</code>; the mount happens lazily when something touches the path. Excellent for removable media and expensive network mounts; a trap for anything that must be present before boot, because the mount now fails late instead of early."],
          ["4d. x-systemd.device-timeout=", "How long to wait for the block device", "The default is 90s, and it is the reason a removed USB disk delays the boot by 90 seconds with no message on a serial console. <code>x-systemd.device-timeout=2s</code> fixes it."],
          ["4e. x-systemd.after=", "Extra ordering", "<code>x-systemd.after=network-online.target</code>, <code>x-systemd.requires=</code>, <code>x-systemd.before=</code>."],
          ["5. dump", "Legacy backup flag", "Always <code>0</code>. Only <code>dump</code>/<code>restore</code> and ancient <code>netBSD</code>-derived tooling ever read it."],
          ["6. pass", "fsck ordering", "<code>1</code> for root, <code>2</code> for the rest, <code>0</code> to skip. systemd does not fsck the root filesystem at all any more; it only fsck mounts that opted in."]
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "An fstab that actually survives a network filesystem, a slow device and a missing disk",
        code: `# /etc/fstab — note: this machine boots off a cloud image, / is ext4 on /dev/vda1
UUID=9f3c1a20-6b7e-4d5c-8a11-0e2f7b9d4c31  /                 ext4  errors=remount-ro,noatime       0 1
UUID=4a71b0d9-2233-44cc-99ee-112233445566  /boot/efi         vfat  umask=0077                    0 1
tmpfs                                      /tmp             tmpfs defaults,nosuid,nodev,size=512M  0 0
# a network share: must not block the boot, must come after the link is actually up
//fileserver/share                          /mnt/share       cifs  credentials=/etc/samba/share.cred,_netdev,x-systemd.requires=network-online.target,x-systemd.automount,nofail,vers=3.0  0 0
# removable media: 2 seconds instead of the 90s default, and never required
UUID=1234-ABCD                              /media/usb       ext4  noauto,nofail,x-systemd.device-timeout=2s,users,umask=002  0 2

$ systemctl daemon-reload
$ systemd-analyze verify var-www-html.mount    # syntax + dependency check, no reboot
$ findmnt --verify --verbose                   # re-read fstab and report what cannot be resolved
$ systemctl status media-usb.mount
$ journalctl -u media-usb.mount -b --no-pager`
      },
      {
        type: "callout",
        kind: "warn",
        title: "Why one bad line stops the boot",
        text: "A <code>.mount</code> unit generated from fstab enters the transaction as a real dependency. If it is <code>Requires=</code>-ing (the default) and the device never appears — a renamed UUID, a controller passthrough that did not happen, a filesystem that needs replaying after a crash — the job times out after <code>DefaultTimeoutStartSec</code> (90s), the boot transaction fails, and systemd drops to <code>emergency.target</code> or <code>rescue.target</code>. On a remote VPS with no physical console that is an unbootable machine, which is why <code>nofail</code> on anything optional and <code>x-systemd.device-timeout=</code> on anything removable are not cosmetic. When you do get a maintenance shell, the diagnosis is <code>systemctl --failed</code> and <code>journalctl -xb</code> — the console scrollback is long gone by then."
      },
      {
        type: "prose",
        h: "Namespaces, bind mounts, pivot_root",
        p: [
          "A <strong>mount namespace</strong> (<code>CLONE_NEWNS</code>) gives a process its own private copy of the mount table. Mounts it makes are invisible to its parent; mounts its parent makes after the clone are invisible to it. This is the mechanism behind <code>unshare -m</code>, behind <code>chroot</code>-based sandboxing, behind every container runtime that exists, and behind a surprising amount of systemd hardening.",
          "<code>systemd</code> uses it on this very machine without you noticing. <code>ProtectSystem=strict</code> remounts <code>/usr</code>, <code>/boot</code> and <code>/etc</code> read-only <em>in the unit's namespace only</em>; <code>ProtectHome=true</code> makes <code>/home</code>, <code>/root</code> and <code>/run/user</code> invisible by overmounting them with empty tmpfs; <code>PrivateTmp=true</code> gives the unit its own <code>/tmp</code> and <code>/var/tmp</code>; <code>ReadWritePaths=</code> punches specific holes back through. All of it is namespace gymnastics implemented by the mount syscall in the child after <code>fork()</code>, before <code>execve()</code>.",
          "A <strong>bind mount</strong> publishes an existing subtree somewhere else without copying anything. Source and destination share the same superblock, the same inodes and the same <code>struct file</code> state — write through one name and you wrote through the other, and a rename on one side is visible on the other because it is the same dentry's parent. <code>mount --bind /var/www/html /srv/site</code> is instantaneous and free; that is not a coincidence, it is the definition of bind. <code>mount --rbind</code> recurses into submounts, and every recursive bind you make must be unmounted recursively or the mount table leaks across the namespace boundary.",
          "<strong>Mount propagation</strong> is the setting people forget. A mount can be <code>shared</code> (events propagate to peer mounts and to namespaces cloned from it), <code>slave</code> (receives, does not send), <code>private</code> (no propagation) or <code>unbindable</code>. After <code>unshare -m</code> the namespace's root is usually made <code>slave</code> so mounts stay inside. Docker sets <code>/</code> to <code>rslave</code> and creates <code>/var/lib/docker/containers/&lt;id&gt;/mounts/shm</code> as a private tmpfs for exactly this reason. <code>findmnt -o PROPAGATION</code> shows the current value; <code>mount --make-rprivate /</code> is the cure for “my mount leaked into my shell”.",
          "<strong>pivot_root(2)</strong> replaces the root of the current mount namespace: <code>pivot_root(new_root, put_old)</code> makes <code>new_root</code> the <code>/</code> and moves the old root underneath <code>put_old</code> so it can be unmounted later. The difference from <code>chroot</code> is the whole point. <code>chroot</code> only changes where the process's path resolution starts; any file descriptor, any already-mounted filesystem, any kernel path like <code>/proc/self/fd</code> or <code>/proc/1/root</code> is still a way out, and <code>chroot</code> has a documented history of being escaped. <code>pivot_root</code> requires <em>new_root to be a mount point</em>, requires <em>put_old to be beneath new_root</em>, and removes the old root from the namespace's view entirely. <code>chroot(2)</code> cannot be used with <code>pivot_root</code> in the same process — the kernel forbids it as a security measure. That pair of restrictions is exactly why container runtimes build a throwaway tree, populate it, pivot into it, and <code>umount2(MNT_DETACH)</code> the leftovers."
        ]
      },
      {
        type: "diagram",
        h: "The same machine, seen through three mount namespaces",
        caption: "Everything below <code>/srv</code> is private to the process that made it. systemd's hardening views are real mounts created in the unit's namespace, which is why a service can be unable to write <code>/etc</code> while your shell can, on the same box, at the same second. <code>pivot_root</code> in the right-hand column is what turns the same trick into containment: the old root is moved under the new one and detached.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="Three mount namespaces sharing one superblock but each with its own mount table">
  <text class="t-title" x="40" y="34" font-size="17">host namespace — your SSH session</text>

  <rect class="box" x="40" y="52" width="1020" height="112" rx="10"/>
  <rect class="box-ok" x="60" y="72" width="150" height="34" rx="6"/>
  <text class="t-sm" x="76" y="94">/usr  rw,ro</text>
  <rect class="box-ok" x="228" y="72" width="150" height="34" rx="6"/>
  <text class="t-sm" x="244" y="94">/var  rw</text>
  <rect class="box-ok" x="396" y="72" width="150" height="34" rx="6"/>
  <text class="t-sm" x="412" y="94">/etc  rw</text>
  <rect class="box-ok" x="564" y="72" width="150" height="34" rx="6"/>
  <text class="t-sm" x="580" y="94">/home  rw</text>
  <rect class="box-w" x="732" y="72" width="150" height="34" rx="6"/>
  <text class="t-sm" x="748" y="94">/srv  → bind</text>
  <text class="t-xs" x="60" y="134">root fs  ext4  /dev/vda1 · shared · the whole story: nothing is hidden from you here</text>

  <line class="ln dash" x1="40" y1="192" x2="1060" y2="192" stroke-width="2"/>

  <text class="t-title" x="40" y="222" font-size="17">the nginx unit — ProtectSystem=strict, ProtectHome=true, PrivateTmp=true</text>

  <rect class="box" x="40" y="240" width="1020" height="140" rx="10"/>
  <rect class="box-w" x="60" y="262" width="150" height="34" rx="6"/>
  <text class="t-sm" x="76" y="284">/usr  ro</text>
  <rect class="box-b" x="228" y="262" width="150" height="34" rx="6"/>
  <text class="t-sm" x="244" y="284">/var  rw</text>
  <rect class="box-b" x="396" y="262" width="150" height="34" rx="6"/>
  <text class="t-sm" x="412" y="284">/etc  ro</text>
  <rect class="box-b" x="564" y="262" width="150" height="34" rx="6"/>
  <text class="t-sm" x="580" y="284">/home EMPTY</text>
  <rect class="box-w" x="732" y="262" width="150" height="34" rx="6"/>
  <text class="t-sm" x="748" y="284">/srv  → bind</text>
  <rect class="box-p" x="60" y="314" width="150" height="34" rx="6"/>
  <text class="t-sm" x="76" y="336">/tmp  private</text>
  <rect class="box-p" x="228" y="314" width="150" height="34" rx="6"/>
  <text class="t-sm" x="244" y="336">/var/tmp priv</text>
  <text class="t-xs" x="396" y="332">same superblock underneath — this is a view, not a copy, so it costs no memory</text>

  <line class="ln dash" x1="40" y1="408" x2="1060" y2="408" stroke-width="2"/>

  <text class="t-title" x="40" y="438" font-size="17">inside the container — build a throwaway tree, then pivot_root into it</text>

  <rect class="box" x="40" y="456" width="1020" height="118" rx="10"/>
  <rect class="box-v" x="60" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="76" y="498">/ merged</text>
  <rect class="box-w" x="198" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="214" y="498">/usr  bind</text>
  <rect class="box-w" x="336" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="352" y="498">/etc  bind ro</text>
  <rect class="box-p" x="474" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="490" y="498">/proc  new</text>
  <rect class="box-p" x="612" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="628" y="498">/dev  new</text>
  <rect class="box-p" x="750" y="476" width="120" height="34" rx="6"/>
  <text class="t-sm" x="766" y="498">/tmp  tmpfs</text>

  <path class="ln-ok" d="M880,493 L930,493" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="906" y="478" font-size="13" text-anchor="middle">pivot_root</text>

  <rect class="box-b" x="934" y="476" width="106" height="34" rx="6"/>
  <text class="t-sm" x="950" y="498">old root</text>

  <text class="t-xs" x="60" y="540">then: umount2("/oldroot", MNT_DETACH) — the host's / is now unreachable from inside.</text>
  <text class="t-xs" x="60" y="560">chroot alone would not do this: any inherited fd, any /proc/1/root, any submount still points outward.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "The three namespace operations, in the order a container runtime performs them",
        code: `# 1. see what you have now
$ findmnt -o TARGET,SOURCE,FSTYPE,PROPAGATION,VFS-OPTIONS / /srv /var/www/html

# 2. a private view, for this process only
$ unshare -m --propagation private bash
#   inside this shell:
#   mount --bind /var/www/html /mnt/site && ls /mnt/site
#   the host sees nothing; exit and it is gone

# 3. bind, read-only bind, recursive bind
$ sudo mount --bind /var/www/html /srv/site
$ sudo mount -o remount,bind,ro /srv/site      # note: remount,bind — plain -o ro is silently ignored
$ sudo mount --rbind /data /mnt/data           # submounts come along
$ findmnt /srv/site
$ sudo umount /srv/site

# 4. propagation, the thing you will forget
$ findmnt -o TARGET,PROPAGATION /
TARGET  PROPAGATION
/       shared
$ sudo mount --make-rprivate /                 # after unshare -m, for instance

# 5. what the running container does, in the same order
#    create /var/lib/docker/containers/<id>/mounts/{merged,shm}
#    pivot_root(merged, .old_root)
#    umount2("/.old_root", MNT_DETACH)   <- detach, not unmount: the fd may still be held

# 6. what pivot_root requires of you
#    new_root  must be a mount point
#    put_old   must be underneath new_root
#    you may not have called chroot(2) in this process — the kernel returns EINVAL`
      },
      {
        type: "prose",
        h: "Overlayfs: a filesystem made of other filesystems",
        p: [
          "Overlayfs is not a filesystem in the ordinary sense. It has no on-disk format, no superblock magic, no inode table. It is a stacking filesystem: each directory it serves is computed on lookup by walking up to N lower directories and one upper directory and deciding, per name, which one wins. Docker's <code>overlay2</code> storage driver, <code>snap</code>, <code>podman</code>'s default, LXC, and the read-only image layers in every container orchestrator are all this one driver.",
          "The mount takes three paths. <code>lowerdir</code> is a colon-separated list, <strong>lowest layer first</strong> — <code>lowerdir=/var/lib/docker/overlay2/l/AAA:/var/lib/docker/overlay2/l/BBB</code> means BBB is searched first and AAA only fills the gaps. <code>upperdir</code> is where every write, create, chmod, rename and unlink lands. <code>workdir</code> is scratch space the kernel uses to stage operations that must be atomic across both layers; it must be on the same filesystem as <code>upperdir</code>, it must be empty, and it must not itself appear in <code>lowerdir</code>.",
          "<strong>Whiteouts</strong> are how a deletion is recorded without touching the lower layer, which is read-only and shared with every other container using the same image. Deleting <code>/usr/bin/ls</code> inside a container creates a <em>character device with major 0, minor 0</em> at that path in the upper directory. Overlayfs intercepts reads: a 0:0 device means “this name is deleted, keep looking down the stack, and if nothing below has it, report <code>ENOENT</code>”. <code>ls -la</code> inside such a directory shows <code>crw-rw-rw- 1 root root 0, 0 … name</code>, which looks like a bug and is not. The extended attribute <code>trusted.overlay.opaque=y</code> on a directory does the same thing for a whole subtree — “ignore everything below this point” — and is how image layers record that a package was removed upstream.",
          "<strong>Why the lower layers are read-only.</strong> Because they are shared. If container A wrote to layer L, container B based on the same image would see it, and deleting a file in A would destroy it for B. Read-only lowers are not a safety policy bolted on afterwards; they are what makes the whole design work, and it is why <code>docker commit</code> exists — to bake a writable container into a new immutable layer.",
          "<strong>The cost.</strong> Overlayfs gives copy-on-write semantics without knowing anything about the underlying filesystem, which is why it works identically on ext4, on xfs, and on the tmpfs-backed store used by <code>docker run</code> during a build. The price is that every lookup walks a chain of directories, whiteouts accumulate and slow lookups down, and hardlinks cannot cross layers. <code>metacopy=on</code> mitigates by copying up only the metadata when only the metadata changed; <code>redirect_dir=on</code> (on by default on most kernels, off on Ubuntu's 4.15 backport for compat reasons) lets renames of whole directories be recorded as redirects instead of copying every child up. <code>userxattr</code>, new in 5.11, moves the <code>trusted.*</code> xattrs into the <code>user.*</code> namespace so unprivileged users can mount overlays at all — not something kernel 4.15 on Ubuntu 18.04 can do."
        ]
      },
      {
        type: "diagram",
        h: "How one lookup in an overlay is decided",
        caption: "The merged view at the top is computed, never stored. A read of <code>/usr/bin/ls</code> is answered from the first layer that has it; a write to it produces a copy-up into the upper directory and hides every lower version. A delete produces a whiteout device node that says “stop here, and if nothing below has it, it does not exist”. That last part is why <code>rm</code> inside a container does not touch the image.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Overlayfs merged view computed from three lower layers and one upper layer, with a whiteout shown">
  <!-- merged -->
  <rect class="box-a" x="330" y="24" width="440" height="76" rx="10"/>
  <text class="t-accent" x="550" y="50" font-size="16" text-anchor="middle">MERGED — the only thing your process sees</text>
  <text class="t-xs" x="550" y="72" text-anchor="middle">a directory computed at lookup time; not a directory, not on any disk</text>
  <text class="t-xs" x="550" y="90" text-anchor="middle">inode numbers here are synthetic and change between lookups</text>

  <path class="ln-a" d="M420,100 L420,140" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln" d="M600,100 L600,140" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln" d="M780,100 L780,140" marker-end="url(#lm-arrow-accent)"/>

  <!-- lower layer 3 -->
  <rect class="box-v" x="330" y="144" width="180" height="130" rx="10"/>
  <text class="t-violet" x="420" y="168" font-size="14" text-anchor="middle">lowerdir[2]</text>
  <text class="t-xs" x="348" y="190">/usr/bin/ls</text>
  <text class="t-xs" x="348" y="212">/etc/nginx/…</text>
  <text class="t-xs" x="348" y="234">/var/log/…</text>
  <text class="t-xs" x="348" y="260">ubuntu 18.04 base</text>

  <!-- lower layer 2 -->
  <rect class="box-v" x="530" y="144" width="180" height="130" rx="10"/>
  <text class="t-violet" x="620" y="168" font-size="14" text-anchor="middle">lowerdir[1]</text>
  <text class="t-xs" x="548" y="190">/usr/bin/ls  (shadowed)</text>
  <text class="t-xs" x="548" y="212">/etc/nginx/…</text>
  <text class="t-xs" x="548" y="234">/app/entrypoint</text>
  <text class="t-xs" x="548" y="260">your app layer</text>

  <!-- lower layer 1 -->
  <rect class="box-v" x="730" y="144" width="180" height="130" rx="10"/>
  <text class="t-violet" x="820" y="168" font-size="14" text-anchor="middle">lowerdir[0]</text>
  <text class="t-xs" x="748" y="190">/usr/bin/ls</text>
  <text class="t-xs" x="748" y="212">/usr/bin/bash</text>
  <text class="t-xs" x="748" y="234">/etc/passwd</text>
  <text class="t-xs" x="748" y="260">the root layer</text>

  <!-- lookup arrows -->
  <path class="ln-ok" d="M560,120 L500,144" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="520" y="132" font-size="13" text-anchor="middle">read hit</text>
  <path class="ln-b" d="M600,120 L600,144" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="600" y="132" font-size="13" text-anchor="middle">copy-up</text>
  <path class="ln-b" d="M640,120 L660,144" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="668" y="132" font-size="13" text-anchor="middle">whiteout</text>
  <path class="ln" d="M680,120 L790,144" marker-end="url(#lm-arrow)"/>

  <!-- upper -->
  <rect class="box-ok" x="530" y="318" width="380" height="116" rx="10"/>
  <text class="t-ok" x="548" y="344" font-size="16">upperdir — every write lands here, and only here</text>
  <text class="t-xs" x="548" y="368">/usr/bin/ls    ← copied up from lowerdir[1], metadata + data</text>
  <text class="t-xs" x="548" y="388">/etc/apt/…     ← your edits, once touched, live in the container</text>
  <text class="t-xs" x="548" y="410">/var/tmp       ← writable scratch that disappears with the container</text>

  <path class="ln-ok" d="M620,274 L640,318" marker-end="url(#lm-arrow-ok)"/>

  <!-- whiteout detail -->
  <rect class="box-b" x="930" y="318" width="140" height="116" rx="10"/>
  <text class="t-bad" x="944" y="344" font-size="14">the whiteout</text>
  <text class="t-xs" x="944" y="368">mknod c 0 0</text>
  <text class="t-xs" x="944" y="388">in the upperdir</text>
  <text class="t-xs" x="944" y="412">says: this</text>
  <text class="t-xs" x="944" y="428">name is gone</text>

  <path class="ln-b" d="M910,376 L928,376" marker-end="url(#lm-arrow-bad)"/>

  <!-- workdir -->
  <rect class="box-w" x="330" y="318" width="180" height="116" rx="10"/>
  <text class="t-warn" x="348" y="344" font-size="14">workdir</text>
  <text class="t-xs" x="348" y="366">same fs as upperdir</text>
  <text class="t-xs" x="348" y="386">must be empty</text>
  <text class="t-xs" x="348" y="406">stages ops that</text>
  <text class="t-xs" x="348" y="424">must be atomic</text>
  <text class="t-xs" x="348" y="428"></text>

  <!-- full command + notes -->
  <rect class="box" x="40" y="470" width="1020" height="146" rx="10"/>
  <text class="t-sm" x="60" y="496" font-size="15">what the mount actually looks like</text>
  <text class="t-xs" x="60" y="520">overlay lowerdir=/var/lib/docker/overlay2/l/AAA:/var/lib/docker/overlay2/l/BBB,upperdir=/var/lib/docker/overlay2/&lt;id&gt;/diff,workdir=/var/lib/docker/overlay2/&lt;id&gt;/work</text>
  <text class="t-xs" x="60" y="544">resolution order per name: upperdir wins · then a 0:0 whiteout ends the search · then lowerdir[1] · then lowerdir[0] · else ENOENT</text>
  <text class="t-xs" x="60" y="566">lowers are read-only because they are shared between every container built from the same image — that is the design, not a policy.</text>
  <text class="t-xs" x="60" y="590">copy-up happens on open-for-write, chmod, chown, rename, truncate and xattr set — not only on a data write.</text>
</svg>
`
      },
      {
        type: "prose",
        h: "Choosing a filesystem: what each one is actually for",
        p: [
          "Every filesystem is a set of trade-offs, and the trade-off is almost never “faster”. It is which failure mode you have accepted: ext4 will not let you shrink a filesystem or take a cheap snapshot; XFS will not let you shrink it at all; btrfs will let you snapshot but will copy an entire file to fix a one-byte change inside it; ZFS will checksum everything but will eat your RAM; tmpfs will give you the fastest possible I/O by giving you none at all once memory runs out.",
          "The default matters more than the benchmark. ext4 is the Ubuntu/Debian default because it is the boring, well-exercised option with a journalling design that survives power loss with no surprises. XFS is the default on RHEL and Fedora for a reason: parallel metadata, large files, and large filesystems done properly — with the hard rule that it cannot be shrunk and that <code>xfs_repair</code> must be run before shrinking, which is how you end up at a maintenance window with a 200 GB filesystem you can only grow.",
          "btrfs became the Fedora default in Fedora 33 and is the SUSE default. It is copy-on-write with checksums on both data and metadata, transparent compression, subvolumes and snapshots that are nearly free, and a built-in RAID1/RAID10. The cost is real: a random 4 KB write inside a 2 GB file copies the entire 2 GB extent, so databases that need true <code>O_DIRECT</code> semantics and heavy random writes are a poor fit, and the notorious <code>BTRFS error: unable to allocate chunk</code> ENOSPC is a space-accounting artefact rather than a genuinely full device.",
          "ZFS is not in the kernel and never will be — it is a kernel module built from the illumos lineage and loaded like a third-party driver. You get checksums on data, snapshots, compression, and a write-ahead log sized as a percentage of RAM, but you also get an ARC that will happily consume most of your RAM. On this 2 GB VPS it would be an absurd choice; on a 64 GB memory server with terabytes of data it is the obvious one. On Ubuntu 18.04 it lives in the <code>universe</code> repository as <code>zfsutils-linux</code> and needs <code>zpool create</code> by hand — you cannot put it in <code>/etc/fstab</code> as a plain device.",
          "tmpfs deserves its own note because it is the one people reach for without understanding. It is a filesystem in RAM with a <code>swapon</code>-style swapfile underneath, defaulting to half of RAM. Writes that fit stay in memory; writes beyond the size limit go to the swap file if there is one, or fail with <code>ENOSPC</code> if there is not. <code>/dev/shm</code> is tmpfs sized at half of RAM and is the classic source of an OOM kill in a container that quietly mounted an enormous shared memory segment — which is exactly why Docker caps it to 64 MB by default and lets you pass <code>--shm-size</code>."
        ]
      },
      {
        type: "table",
        cols: ["Filesystem", "On-disk model", "Its actual strength", "What it costs you", "Where it is the default"],
        rows: [
          ["<strong>ext4</strong>", "jbd2 journal + block groups + extents", "Predictability. Mount, work, unmount for years with no operator involvement. Fast enough that nothing you serve static files on will ever notice.", "No snapshots. No checksums on data. Growing requires unmount unless the kernel can use the new space. Shrinking is offline-only and awkward.", "Debian, Ubuntu, Arch, most of the Linux server world"],
          ["<strong>XFS</strong>", "B+tree metadata, allocation groups", "Parallel metadata updates and very large filesystems and very large files. Well-understood behaviour at scale.", "<strong>Cannot be shrunk.</strong> A repair is required to shrink. <code>xfs_repair</code> is not something you do casually.", "RHEL 7+, Fedora, CentOS Stream"],
          ["<strong>btrfs</strong>", "copy-on-write, B+tree, checksums on data + metadata", "Cheap snapshots and subvolumes, transparent compression, integrity you can actually verify, single-device RAID1.", "Random writes copy whole extents. ENOSPC from space accounting. More knobs than anyone needs, and a support matrix that varies per distro.", "Fedora 33+, openSUSE, SUSE Linux Enterprise 15"],
          ["<strong>ZFS</strong>", "copy-on-write, uberblock, transaction groups", "End-to-end checksums, snapshots as a first-class citizen, compression, <code>send/receive</code> replication, zpool RAID", "Out-of-tree module. An ARC that caches aggressively in RAM. Pool management is a real discipline, not a <code>mkfs</code>.", "FreeBSD, Illumos, Nexenta; on Linux only by deliberate choice"],
          ["<strong>tmpfs</strong>", "pages, optionally swap-backed", "Reads and writes that never touch a device. Survives no reboots because it is memory.", "RAM is the disk. Writes past the limit go to swap or fail. Data is lost on power cut — by design, since that is what the kernel intends to discard.", "<code>/run</code>, <code>/dev/shm</code>, systemd's <code>PrivateTmp=</code>, Kubernetes <code>emptyDir</code>"],
          ["<strong>overlayfs</strong>", "none — it has no on-disk format at all", "Copy-on-write layers with no space cost for unmodified data, and it works on top of anything.", "Lookup cost grows with depth, whiteouts accumulate, hardlinks cannot cross layers, and a deep chain of images gets slow.", "Docker <code>overlay2</code>, podman, snap, every container image you have pulled"]
        ]
      },
      {
        type: "callout",
        kind: "fact",
        title: "Docker's default is not the one you think",
        text: "Docker's <code>overlay2</code> driver stores each layer as a directory of plain files, so the <em>underlying</em> filesystem is whatever you gave the machine — ext4 here. The older <code>overlay</code> driver used a <code>diff</code> directory per container that had to be in the backing filesystem's format, and is gone in Docker 17.06+. <code>devicemapper</code>, which stacked block devices, was removed in Docker 18.09+; if you are reading advice that mentions it, the advice is from 2017. Neither fact changes the overlay model described above."
      },
      {
        type: "prose",
        h: "Device files: a filename that happens to reach the driver",
        p: [
          "A block or character device node is an inode whose <code>i_rdev</code> is set, containing a <strong>major</strong> and <strong>minor</strong> number. Nothing about it points at hardware; the number is a key into a table in the kernel. On this machine, <code>ls -l /dev/null</code> gives <code>crw-rw-rw- 1 root root 1, 3 …</code> — major 1 is <code>mem</code>, minor 3 is <code>null</code>. <code>/dev/zero</code> is <code>1, 5</code>; <code>/dev/full</code> is <code>1, 7</code>; <code>/dev/sda</code> is <code>8, 0</code>, where major 8 is <code>sd</code>; <code>/dev/vda</code> is <code>254, 0</code>. The major number identifies the <em>driver</em>, not the disk, which is why a hundred partitions of one disk share major 8.",
          "The driver installs a <code>file_operations</code> table for the node, and the syscall goes straight there without a filesystem ever being involved. For <code>/dev/null</code> the write handler is about four lines long: count the bytes, discard them, return the count. The data is never copied anywhere, never written to a page cache, never reaches the device. That is why <code>&gt; /dev/null</code> is instant regardless of how fast your disk is, why <code>cp /dev/urandom /dev/null</code> burns CPU exactly as much as <code>cp /dev/urandom /var/tmp/x</code> does, and why a process whose stdout is <code>/dev/null</code> can produce gigabytes of output without producing gigabytes of anything.",
          "<code>/dev/full</code> is the useful contrast: same driver, minor 7, but every <code>write()</code> returns <code>ENOSPC</code>. A program that claims to have written successfully, which is precisely the failure mode a disk-full error is meant to catch, hits it immediately and cheaply. <code>/dev/random</code> and <code>/dev/urandom</code> are <code>1, 8</code> and <code>1, 9</code>; since kernel 5.6 <code>/dev/random</code> blocks only until the CRNG is initialised and then behaves like urandom, and the difference between the two is whether the read ever sleeps at all.",
          'udev does not create these. devtmpfs, built into the kernel, creates a node the instant a driver calls <code>device_add()</code>, which is why a hotplugged disk has a <code>/dev/sdX</code> before any userspace rule runs. udev then <em>decorates</em>: it sets group and permissions, applies symlinks like <code>/dev/disk/by-uuid/…</code>, reacts to <code>KERNEL=="sd*"</code> and renames a device if you asked for it, and runs the <code>.rules</code> you wrote. If devtmpfs is not mounted and udev is not running, you get an empty <code>/dev</code> and nothing starts — which is the state of a system that booted with <code>root=/dev/vda</code> while only static <code>/dev</code> nodes existed in the initramfs. The fix there is a <code>rootdelay</code> kernel parameter or a <code>root=UUID=</code> that udev can act on; the diagnosis is <code>ls /dev/vda*</code> on the rescue console.'
        ]
      },
      {
        type: "diagram",
        h: "Three ways the same bytes of output go",
        caption: "Identical <code>write()</code> calls, identical cost to <em>produce</em> the bytes, radically different cost to <em>dispose</em> of them. Only the middle row survives a reboot. The right column is the one that quietly eats a 19 GB disk: an open descriptor to a log file that has been unlinked keeps its blocks allocated for as long as the descriptor lives.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Three destinations for write output: null device, page cache and disk, and an unlinked but open file">
  <rect class="box-a" x="40" y="24" width="1020" height="60" rx="10"/>
  <text class="t-accent" x="60" y="52" font-size="15">the process calls write(1, buf, n) — the same call in all three cases</text>
  <text class="t-xs" x="60" y="74">the difference is which file_operations table and which inode the descriptor 1 points at</text>

  <path class="ln" d="M550,84 L550,110"/>
  <path class="ln" d="M190,110 L910,110"/>
  <path class="ln" d="M190,110 L190,140" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M550,110 L550,140" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M910,110 L910,140" marker-end="url(#lm-arrow)"/>

  <!-- null -->
  <rect class="box-v" x="40" y="144" width="300" height="250" rx="10"/>
  <text class="t-violet" x="58" y="172" font-size="16">/dev/null — crw-rw-rw- 1, 3</text>
  <text class="t-xs" x="58" y="198">null_write():</text>
  <text class="t-xs" x="58" y="218">  add_left(&amp;file-&gt;f_count, bytes)</text>
  <text class="t-xs" x="58" y="238">  return bytes;</text>
  <text class="t-xs" x="58" y="262">four lines of kernel code, then</text>
  <text class="t-xs" x="58" y="282">the bytes are gone. no copy,</text>
  <text class="t-xs" x="58" y="302">no page cache, no device.</text>
  <text class="t-ok" x="58" y="334" font-size="14">space used: 0 bytes, always</text>
  <text class="t-xs" x="58" y="358">works while the disk is full,</text>
  <text class="t-xs" x="58" y="378">while / is read-only, while the</text>
  <text class="t-xs" x="58" y="398">device is gone.</text>

  <!-- real file -->
  <rect class="box-ok" x="400" y="144" width="300" height="250" rx="10"/>
  <text class="t-ok" x="418" y="172" font-size="16">/var/log/nginx/access.log</text>
  <text class="t-xs" x="418" y="198">generic_file_write_iter()</text>
  <text class="t-xs" x="418" y="218">  copy into page cache</text>
  <text class="t-xs" x="418" y="238">  mark pages dirty</text>
  <text class="t-xs" x="418" y="258">  writeback worker, later:</text>
  <text class="t-xs" x="418" y="278">  submit_bio → virtio_blk → vda1</text>
  <text class="t-xs" x="418" y="302">  jbd2 commits first (data=ordered)</text>
  <text class="t-xs" x="418" y="330" font-size="14">survives reboot: yes</text>
  <text class="t-xs" x="418" y="356">that is why this one fills</text>
  <text class="t-xs" x="418" y="376">the 19 GB disk, and why</text>
  <text class="t-xs" x="418" y="396">logrotate exists at all</text>

  <!-- unlinked -->
  <rect class="box-b" x="760" y="144" width="300" height="250" rx="10"/>
  <text class="t-bad" x="778" y="172" font-size="16">the same log, then rm</text>
  <text class="t-xs" x="778" y="196">nlink 1 → 0, name unlinked.</text>
  <text class="t-xs" x="778" y="216">The inode stays alive because</text>
  <text class="t-xs" x="778" y="236">nginx still holds an fd.</text>
  <text class="t-xs" x="778" y="260">Every write still succeeds.</text>
  <text class="t-xs" x="778" y="280">Every block is still allocated.</text>
  <text class="t-bad" x="778" y="310" font-size="14">survives reboot: no</text>
  <text class="t-xs" x="778" y="334">visible to ls: no</text>
  <text class="t-xs" x="778" y="354">visible to du: no</text>
  <text class="t-xs" x="778" y="374">visible to df: YES</text>
  <text class="t-xs" x="778" y="398">the disk fills with nothing on it</text>

  <path class="ln-b" d="M910,394 L910,414" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-w" x="40" y="418" width="1020" height="118" rx="10"/>
  <text class="t-warn" x="60" y="444" font-size="15">the disk accounting, precisely</text>
  <text class="t-xs" x="60" y="468">df reports allocated blocks. du reports reachable inodes. An inode with nlink=0 and one open descriptor is allocated but unreachable,</text>
  <text class="t-xs" x="60" y="490">so df and du legitimately disagree. ext4 will not free the blocks until both reach zero — the link count AND the open-file count.</text>
  <text class="t-xs" x="60" y="516">This is not an ext4 quirk: it is POSIX behaviour, and XFS, btrfs, ZFS and tmpfs all do it. The difference is only in what you can do about it afterwards.</text>
</svg>
`
      },
      {
        type: "code",
        lang: "bash",
        what: "Find the invisible disk usage, and the permissions layers you may not know you have",
        code: `# 1. the one-liner that always solves it
$ lsof +L1
COMMAND    PID USER   FD  TYPE NLINK    SIZE/OFF   NODE NAME
nginx     1841 www   17w  REG      0 2147483648 481930 /var/log/nginx/access.log (deleted)

#   NLINK 0 with a live descriptor. SIZE/OFF is what you are actually losing.

# 2. same thing without lsof installed, straight out of procfs
$ for p in /proc/[0-9]*; do
    for f in $p/fd/*; do
      t=$(readlink "$f" 2>/dev/null)
      case "$t" in *"(deleted)"*) echo "$p \${f##*/} $t";; esac
    done
  done

# 3. who holds the inode open
$ fuser -v /var/log/nginx/access.log
# or, since you are on systemd anyway
$ lsof -p $(pidof nginx | tr ' ' ',') -a -d 0-99

# 4. logrotate's three real options
#   create        — mv + touch: breaks hardlinks, and leaves old fds on the renamed file
#   copytruncate  — cp then : > : one inode, no race-free property, but nothing is left open
#   renameat2 RENAME_EXCHANGE — atomic swap, needs Linux 3.15+, works on ext4/overlayfs,
#     but NOT on NFSv3 and not on older kernels. This is the correct modern answer:
#   postrotate
#       /usr/bin/systemctl reload nginx
#   endscript
$ grep -n "copytruncate" /etc/logrotate.d/nginx

# 5. permissions, three independent layers
$ getfacl /etc/nginx/nginx.conf
# owner: root
# group: root
# user::rw-
# group::r--
# other::---
# user:www-data:r--        <- the + in ls -l means an ACL is present
$ setfacl -m u:deploy:rw /etc/nginx/nginx.conf
$ setfacl -d -m u:www-data:r-x /var/www/html   # default ACL: inherited by new files
#   stored as the xattr system.posix_acl_access — which is why rsync -a drops it
#   you need -A (--acls) and -X (--xattrs) to carry ACLs and xattrs across your deploy

# 6. inode flags: above DAC, below MAC
$ lsattr /etc/iptables/rules.v4
----i------- /etc/iptables/rules.v4
$ chattr +i /etc/iptables/rules.v4   # immutable: even root cannot write it until -i
#   requires CAP_LINUX_IMMUTABLE; +a is append-only (log files, audit trails)
#   it is an inode flag, not a permission — no group, no owner, no inheritance`
      },
      {
        type: "prose",
        h: "DAC, ACLs, inode flags and MAC: four gates, in the order the kernel checks them",
        p: [
          "<strong>DAC</strong> — discretionary access control — is the owner/group/other triple, and it is discretionary because the owner may give it away. Root bypasses it entirely through <code>CAP_DAC_OVERRIDE</code> and <code>CAP_DAC_READ_SEARCH</code>, which is why “root can always read it” is true on every distro except those with a MAC policy enforcing otherwise. It is the model in POSIX and it is what <code>chmod 644</code> configures.",
          "<strong>POSIX ACLs</strong> extend DAC without replacing it. An ACL adds named users and groups as extra entries; the mask entry caps the effective permissions of all named entries and the group entry, and <code>ls -l</code> grows a <code>+</code> to tell you one is present. They are xattrs — <code>system.posix_acl_access</code> for files, <code>system.posix_acl_default</code> for directories — which has a practical consequence: anything that copies files without preserving xattrs silently destroys them. On a box where sites are published with <code>rsync -a</code>, the <code>-a</code> flag does not include ACLs; you need <code>-A</code>. This is the kind of detail that turns into a production incident, because the deploy works fine until the day somebody adds an ACL.",
          "<strong>Inode flags</strong> — immutable (<code>+i</code>), append-only (<code>+a</code>), and the dump/undump and compression flags — live in <code>i_flags</code> on the inode itself. They are not permissions: there is no owner or group, they do not inherit, and they apply to the directory entry as well as the data. Setting one needs <code>CAP_LINUX_IMMUTABLE</code>, which is why <code>chattr +i</code> as an unprivileged user returns <code>Operation not permitted</code> and not a permission error about the file. The classic use is protecting a restored firewall ruleset from an accidental write, and the classic surprise is that <code>chattr +i</code> on a file inside an overlayfs upper directory behaves differently from one on a plain ext4 file, because the flag is stored in an inode field overlayfs does not always copy up.",
          '<strong>MAC</strong> — mandatory access control — is the fourth gate, and it is the only one that is not discretionary. The kernel exposes an LSM hook, a policy decides, and there is no way for a root process to override it. Ubuntu and Debian ship <strong>AppArmor</strong>, which is path-and-profile based and on by default with a profile per daemon; a denial appears in <code>dmesg</code> as <code>audit: type=1400 audit(…): apparmor="DENIED" operation="open" profile="/usr/sbin/nginx" name="/etc/shadow"</code>. Fedora, RHEL and openSUSE ship <strong>SELinux</strong>, which is label-based, driven by <code>sesearch</code>, and defaults to enforcing on the login path. Alpine ships neither by default. <code>aa-status</code> on Ubuntu, <code>sestatus</code> and <code>ausearch -m avc</code> on Fedora. Note the ordering: the MAC hook runs <em>before</em> the DAC check returns for most operations, so on an SELinux box a root-owned file can be unreadable, and the error you get is <code>Permission denied</code> with no hint that a policy was involved.'
        ]
      },
      {
        type: "kv",
        items: [
          { k: "<code>/proc</code> — procfs", v: "Read-only by default, synthesised from <code>task_struct</code> at read time. Zero bytes on disk. <code>/proc/PID/fd</code>, <code>/proc/PID/maps</code>, <code>/proc/sys/*</code> and <code>/proc/self/mountinfo</code> are all here, and every one of them is a live view rather than a file." },
          { k: "<code>/sys</code> — sysfs", v: "One directory per kobject, one file per attribute, each file a window onto a kernel variable. Read it and you read the live value; write it and you change the running system. This is why <code>/sys/class/net/eth0</code> is where interface settings live and why hotplug is possible at all." },
          { k: "<code>/dev</code> — devtmpfs", v: "Device nodes created by the kernel driver registering. udev decorates them afterwards. <code>/dev/null</code> is <code>1, 3</code>; <code>/dev/zero</code> is <code>1, 5</code>; <code>/dev/full</code> is <code>1, 7</code> and returns <code>ENOSPC</code> on every write." },
          { k: "<code>/run</code> — tmpfs", v: "Runtime state that must not survive a reboot: PIDs of things that do not want them, sockets, systemd's own bookkeeping, <code>/run/lock</code>. Created by the generator before any service unit starts, and therefore the first filesystem to be populated." },
          { k: "<code>/sys/fs/cgroup</code>", v: "On this Ubuntu 18.04 host, cgroups <strong>v1</strong>: separate hierarchies mounted at <code>/sys/fs/cgroup/memory</code>, <code>/sys/fs/cgroup/cpu</code>, <code>/sys/fs/cgroup/pids</code> and so on, each a different filesystem with its own files. On v2 (kernel 4.5+, default from Ubuntu 22.04) there is one <code>cgroup2</code> mount and controllers are enabled per-branch by writing the controller name to <code>cgroup.subtree_control</code>." },
          { k: "<code>/etc/fstab</code>", v: "Input to <code>systemd-fstab-generator</code>, which emits <code>foo.mount</code> units that join the normal boot transaction. Escape the path into the unit name: <code>/var/www/html</code> is <code>var-www-html.mount</code>, and <code>/</code> is <code>-.mount</code>." },
          { k: "The inode", v: "The file's identity: mode, owner, timestamps, size, extent map, link count. Survives <code>rename</code>. Not the name. Unique only within one filesystem." },
          { k: "The dentry", v: "A cached name-to-inode link. Kernel memory only, evictable, can be negative. This is what makes repeated path lookups cheap and what makes a long-running process sometimes not see a file that was just created." },
          { k: "The <code>struct file</code>", v: "An open instance: offset, flags, path, operations. Counted by <code>fs.file-max</code>, exposed at <code>/proc/PID/fd/N</code>, inherited across <code>execve</code> unless it carries <code>FD_CLOEXEC</code>." }
        ]
      }
    ],
    takeaways: [
      "<code>/</code> is a dentry inside a superblock, not a directory on a disk. Everything else in the tree is a graft, and crossing one changes every assumption you had about ownership, options and failure modes.",
      "Inode is identity, path is a name, dentry is a cache entry, and <code>struct file</code> is an open instance. Four objects, four lifetimes; conflating them explains hardlinks, rotation failures and inode-number nonsense.",
      "<code>open()</code> returning <code>EMFILE</code> is your process hitting <code>RLIMIT_NOFILE</code> — 1024 by default for a systemd unit on this release — and <code>ENFILE</code> means the system hit <code>fs.file-max</code>. <code>fs.nr_open</code> caps both.",
      "Descriptors survive <code>execve</code> unless they carry <code>FD_CLOEXEC</code>, which is the entire mechanism behind pipes, shell redirection and systemd's <code>StandardOutput=</code>.",
      "A hardlinked log cannot be rotated the way people expect, and a modern editor breaks links by design, because both operations are rename-and-replace against an inode that keeps its identity.",
      "A bad <code>/etc/fstab</code> line is a systemd dependency failure, not a shell script error: the mount unit times out after 90 seconds and the machine lands in <code>emergency.target</code>. <code>nofail</code> and <code>x-systemd.device-timeout=</code> are what keep a VPS reachable.",
      "Mount namespaces give private views of the same superblocks — that is how <code>ProtectSystem=</code>, <code>PrivateTmp=</code>, bind mounts and containers all work. <code>pivot_root</code> is what turns the trick into containment; <code>chroot</code> is not.",
      "A deleted-but-open file is allocated, unreachable, invisible to <code>ls</code> and <code>du</code>, and fully counted by <code>df</code>. <code>lsof +L1</code> is the command that finds it, and on a 19 GB disk it is the difference between a mystery and a minute of work."
    ],
    glossary: {
      "superblock": "The in-memory and on-disk representation of one mounted filesystem: block size, free space, root inode, mount options.",
      "inode": "The record that is the file's identity — mode, ownership, timestamps, size, block map, link count — stored in the filesystem's inode table.",
      "dentry": "A cached directory entry linking a name to an inode. Exists only in memory, is evictable, and can be negative to cache a non-existence.",
      "struct file": "The kernel object representing one open file: offset, flags, operations pointer. Counted by fs.file-max and listed in /proc/PID/fd.",
      "hardlink": "A second directory entry pointing at the same inode. Same data, same identity; cannot cross a filesystem, and behaves identically under rename.",
      "symlink": "A file whose contents are a path string, resolved relative to its own directory. Has its own inode and can dangle.",
      "FD_CLOEXEC": "Descriptor flag that makes the kernel close the descriptor during execve, so sockets and secrets are not leaked into child processes.",
      "mount namespace": "A process's private copy of the mount table. Mounts made inside are invisible outside and vice versa.",
      "pivot_root": "The syscall that replaces the root of a mount namespace and detaches the old one, providing real containment where chroot does not.",
      "overlayfs": "A stacking filesystem that merges one writable upper directory over one or more read-only lower directories, using 0:0 device nodes as whiteouts.",
      "whiteout": "A character device with major 0, minor 0, created in an overlay upper directory to record the deletion of a name that exists in a lower layer.",
      "EMFILE": "The per-process open-descriptor limit was reached; open() failed for this process.",
      "ENFILE": "The system-wide file-handle limit was reached; open() failed for everybody.",
      "nr_open": "The system-wide ceiling on how large RLIMIT_NOFILE's hard limit may be set. 1048576 on every current distro.",
      "noatime": "Mount option that stops the kernel updating access times on read, removing a write from the hot read path.",
      "nofail": "fstab option that makes the generated mount unit a Wants= rather than a Requires=, so the boot does not fail when the filesystem is absent.",
      "POSIX ACL": "A named-user and named-group access control list stored as a system.posix_acl_access xattr, extended by and layered on top of the owner/group/other model.",
      "chattr": "The command that sets inode flags. +i is immutable, +a append-only; both require CAP_LINUX_IMMUTABLE and neither is a permission.",
      "VFS": "The Virtual File System layer that gives every filesystem the same inode/dentry/file interface, so syscalls do not care what is underneath.",
      "copy-up": "The overlayfs operation that materialises a lower-layer file into the upper directory before it can be modified, leaving the lower copy untouched and invisible."
    }
  });
})();