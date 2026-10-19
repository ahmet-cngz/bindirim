from django.contrib import admin

from .models import PriceAlert, PriceObservation, Product, Watch


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "title",
        "store",
        "current_price",
        "availability",
        "status",
        "last_checked_at",
    ]
    list_filter = ["store", "status", "availability"]
    search_fields = ["title", "url"]
    readonly_fields = ["lease_id", "lease_until"]


admin.site.register([Watch, PriceObservation, PriceAlert])
