from django.conf import settings
from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    email_notifications_available = serializers.SerializerMethodField()

    def get_email_notifications_available(self, obj):
        return bool(
            settings.RESEND_API_KEY and settings.NOTIFICATION_FROM_EMAIL
        )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "date_joined",
            "email_notifications_enabled",
            "email_notifications_available",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(
        write_only=True, max_length=128, trim_whitespace=False
    )

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(
                attrs["password"], User(email=attrs["email"])
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": exc.messages}
            ) from exc
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"email": "An account with this email already exists."}
            ) from exc


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True, max_length=128, trim_whitespace=False
    )

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        return {"user": user}


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(
        write_only=True, max_length=128, trim_whitespace=False
    )

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class NotificationPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email_notifications_enabled"]
