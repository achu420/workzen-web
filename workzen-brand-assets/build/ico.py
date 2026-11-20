import struct, sys
S='/private/tmp/claude-501/-Volumes-work-disk-Codes-Tracker/c63c7fd8-b7d5-47f2-a031-ede68725c4e2/scratchpad/out/favicon'
def ico(prefix, dst):
    sizes=[16,32,48]; imgs=[open(f'{S}/{prefix}-{n}.png','rb').read() for n in sizes]
    hdr=struct.pack('<HHH',0,1,len(sizes)); off=6+16*len(sizes); ent=b''; body=b''
    for n,d in zip(sizes,imgs):
        ent+=struct.pack('<BBBBHHII',n,n,0,0,1,32,len(d),off+len(body)); body+=d
    open(dst,'wb').write(hdr+ent+body)
ico('favicon', f'{S}/favicon.ico'); ico('favicon-light', f'{S}/favicon-light.ico'); ico('favicon-dark', f'{S}/favicon-dark.ico')
