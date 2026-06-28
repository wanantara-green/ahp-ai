"""
0002_seed_initial_experts — Muat data awal 15 pakar (fixtures/initial_experts.json)
saat instalasi pertama (database kosong). Tidak menimpa data yang sudah ada.
"""
from django.core.management import call_command
from django.db import migrations


def load_initial_experts(apps, schema_editor):
    ExpertResponse = apps.get_model("kobo_mce", "ExpertResponse")
    # Hanya seed bila belum ada respons sama sekali (instalasi awal).
    if ExpertResponse.objects.exists():
        return
    call_command("loaddata", "initial_experts", app_label="kobo_mce", verbosity=0)


def unload_initial_experts(apps, schema_editor):
    # Reverse aman: tidak menghapus apa pun (data bisa sudah dimodifikasi pengguna).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("kobo_mce", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(load_initial_experts, unload_initial_experts),
    ]
